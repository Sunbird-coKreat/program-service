const envVariables = require('../envVariables')
const uuid = require("uuid/v1")

const learnerService = envVariables['LEARNER_SERVICE_URL']
const axios = require('axios');
const _ = require("lodash");
const { successResponse, errorResponse, loggerError } = require('../helpers/responseUtil');
const KafkaService = require('../helpers/kafkaUtil')
const RegistryService = require('./registryService')
const registryService = new RegistryService()
const loggerService = require('./loggerService');
const messageUtils = require('./messageUtil');
const responseCode = messageUtils.RESPONSE_CODE;
const userMessages = messageUtils.USER;
var async = require('async');
const { response } = require('express');
let logObject = {};
let errorStatusCode = 500;
let userProfile = {};
async function getSunbirdUserProfiles(req, identifier, fields=[])  {
    const option = {
      // TODO: for local private end point will not work we had to change to "user/v3/search"
      url: learnerService + '/user/v1/fuzzy/search',
      method: 'post',
      headers: {
        ...req.headers
      },
      data: {
        "request": {
          "filters": {
            "identifier": identifier
          }
        }
      }
    };
    if (!_.isEmpty(fields)) {
      option.data.request.fields = fields;
    }
    return axios(option);
}

function getOsRequestBody(action, osRequest) {
  return regReq = {
    body: {
      id: "open-saber.registry." + action,
      request: osRequest
    }
  }
}

function searchRegistry(entity, filter, callback) {
  let request = {
    entityType: entity,
    filters: filter
  }
  let regReq = getOsRequestBody('search', request)
  return registryService.searchRecord(regReq, callback);
}

function getOSUserDetails(userId, callback) {
  let filter= {
      userId: {
          eq: userId
      }
    }
  searchRegistry(["User"], filter, (err, res) => {
    if (res && res.status == 200) {
      if (res.data.result.User.length > 0) {
        var userDetails = res.data.result.User[0];
        callback(null, userDetails)
      } else {
        errorStatusCode = 404;
        callback({"response": "User not found in OS"}, {});
        }
    } else {
      callback(err);
    }
  });
}

function getOSUserOrgMapping(osUser, callback) {
  if (osUser.userId) {
    let filter= {
      userId: {
        eq: osUser.osid
      }
    }
    searchRegistry(["User_Org"], filter, (err, res) => {
      if (res && res.status == 200) {
        if (res.data.result && res.data.result.User_Org.length > 0) {
          userOrgMapList = res.data.result.User_Org
          callback(null, osUser, userOrgMapList)
        } else {
            callback(null, osUser, {});
          }
      } else {
        callback(error)
      }
    });
  } else {
    callback(null, osUser, {});
  }
}

function getOSOrg(osUser, osUserOrg, callback) {
  if (osUserOrg.length) {
    const orgList = osUserOrg.map((value) => value.orgId)
    let filter= {
      osid: {
        or: orgList
      }
    }
    searchRegistry(["Org"], filter, (err, res) => {
      if (res && res.status == 200) {
        if (res.data.result.Org.length > 0) {
          callback(null, osUser, osUserOrg, res.data.result.Org)
        } else {
            callback(null, osUser,osUserOrg, {});
          }
      } else {
        callback(error);
      }
    });
  } else {
    callback(null, osUser, osUserOrg, {})
  }
}

function searchAdminOfOrg (orgOsId, callback) {
  let filter = {
          orgId: {
            eq: orgOsId
          },
          roles: {'contains': 'admin'}
  }
  return searchRegistry(["User_Org"], filter, callback);
}

function searchOSUserWithOsId (userOsId, callback) {
  let filter = {
       osid: {
        eq: userOsId
      }
    }
  return searchRegistry(["User"], filter, callback);
}

function handleUserDeleteSuccess(req, response, result){
  var rspObj = req.rspObj
  rspObj.responseCode = 'OK'
  rspObj.result = result
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  return response.status(200).send(successResponse(rspObj));
}

function handleUserDeleteError (req, response, error) {
  var rspObj = req.rspObj
  console.log('User deletion failed', JSON.stringify(error))
  if(error && error.response && error.response.data) {
    console.log(`User delete error ==> ${req.params.userId}  ==>`, JSON.stringify(error.response.data));
  }
  const errCode = userMessages.DELETE.EXCEPTION_CODE;
  rspObj.errCode = userMessages.DELETE.FAILED_CODE;
  rspObj.errMsg = userMessages.DELETE.FAILED_MESSAGE
  rspObj.responseCode = responseCode.SERVER_ERROR
  rspObj.result  = error;
  loggerError(rspObj, errCode);
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  return response.status(errorStatusCode).send(errorResponse(rspObj, errCode));
}

function generateDeleteUserEvent(req, response, userDetails, replacementUsers) {
  var ets = Date.now();
  var dataObj = {
    'eid': 'BE_JOB_REQUEST',
    'ets': ets,
    'mid': `LP.${ets}.${uuid()}`,
    'actor': {
      'id': 'coKreat Flink Job',
      'type': 'System'
    },
    'context': {
      'pdata': {  
        'ver': '1.0',
        'id': 'org.sunbird.platform'
      }
    },
    'object': {
      'type': 'user',
      'id': req.params.userId
    },
    'edata': {
      'action': 'delete-user',
      'iteration': 1,
      'organisationId': userProfile.rootOrgId,
      'userId': req.params.userId,
      'userName': userProfile.userName,
      'suggested_users' : replacementUsers
    }
  }

  return dataObj;
}


async function deleteUser(req, response) {
  logObject['message'] = userMessages.DELETE.INFO
  logObject['traceId'] = req.headers['x-request-id'] || '',
  loggerService.entryLog(req.body, logObject);
  var rspObj = req.rspObj
  const reqHeaders = req.headers;
  if (req.params.userId) {
    try {
      const userRes = await getSunbirdUserProfiles({'headers': reqHeaders}, req.params.userId);
      let orgUsersDetails = _.get(userRes.data, 'result.response.content');
      if (orgUsersDetails && !_.isEmpty(_.first(orgUsersDetails))) {
        userProfile = _.first(orgUsersDetails);
        async.waterfall([
          function (callback) {
            getOSUserDetails(req.params.userId, callback)
          },
          function (user, callback) {
            getOSUserOrgMapping(user, callback);
          },
          function (user, osUserOrg, callback) {
            getOSOrg(user, osUserOrg, callback)
          },
          function (user, osUserOrg, osOrgs, callback) {
            getUserOsRecord(user, osUserOrg, osOrgs, callback)
          }
        ], function (err, res) {
          if (err) {
            handleUserDeleteError(req, response, err);
          } else {
            deleteUserAccordingtoOrgRole(req, response, res)
          }
        });
      } else {
        errorStatusCode = 404;
        handleUserDeleteError(req, response, {"response": "User not found in Sunbird"});
      }
    }  catch(error) {
      handleUserDeleteError(req, response, error);
    }
  } else {
    rspObj.errCode = userMessages.DELETE.MISSING_CODE
    rspObj.errMsg = userMessages.DELETE.MISSING_MESSAGE
    rspObj.responseCode = responseCode.CLIENT_ERROR
    loggerError(rspObj,errCode);
    loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
    return response.status(400).send(errorResponse(rspObj,errCode))
  }
}

function getUserOsRecord(user, osUserOrg, osOrgs, callback) {
  let err = null;
  try {
    user['osOrgRoles'] = [];
    if (osOrgs.length) {
      osOrgs.map((org) => {
        let roles = null
        let userOrgOsid = null
        osUserOrg.forEach(function (element, index, array) {
          if (org.osid === element.orgId) {
            roles = element.roles;
            userOrgOsid = element.osid;
          }
        });
        org['userOrgOsid'] = userOrgOsid
        org['roles'] = roles;
        user['osOrgRoles'] = user['osOrgRoles'].concat(roles);
      });
      user['orgs'] = osOrgs;
    } else {
      user['osOrgRoles'] = ["individual"];
    }
  } catch (e) {
    err  = e;
  }
  callback(err, user)
}

function deleteUserAccordingtoOrgRole(req,response, osUser) {
  if (osUser.osOrgRoles.includes('individual') || osUser.osOrgRoles.includes('user')) {
    deleteOsUser(osUser, (err, res) => {
      if (res && res.status == 200 && _.get(res.data, 'params.status') == "SUCCESSFUL") {
        if (osUser.osOrgRoles.includes('individual')) {
          onIndividualUserDeletion(req,response, osUser);
        }
        if (osUser.osOrgRoles.includes('user')) {
          onOrgUserDeletion(req,response, osUser)
        }
      }
      else {
        handleUserDeleteError(req, response, err)
      }
    })
  }

  if (osUser.osOrgRoles.includes('admin') || osUser.osOrgRoles.includes('sourcing_admin') || osUser.osOrgRoles.includes('sourcing_reviewer')) {
    handleUserDeleteError(req, response, {"response": "Can only delete Individual or contributing org user"});
  }
}

function deleteOsUser (userDetails, callback) {
  let request = {
    User: {
      osid: userDetails.osid,
      isDeleted: true
    }
  }
  let regReq = getOsRequestBody('update', request)

  return registryService.updateRecord(regReq, callback);
}

async function transferAssetOfDeleteduser(req, response){
  logObject['message'] = userMessages.DELETE.OWNERSHIP_TRANSFER
  logObject['traceId'] = req.headers['x-request-id'] || '',
  loggerService.entryLog(req.body, logObject);
  try {
  KafkaService.sendRecordWithTopic(req.rspObj.request, envVariables.COKREAT_USER_DELETE_KAFKA_TOPIC, function (err, res) {
    if (err) {
      handelAssetOwnershiptransfer(req, err);
    } else{
      return response.status(200).send(successResponse(rspObj));
    }
  });
 }catch(err) {
  handelAssetOwnershiptransfer(req, err)
 }
}

function handelAssetOwnershiptransfer(req, err){
  var rspObj = req.rspObj
  console.log('User transferAssetOfDeleteduser failed', JSON.stringify(err))
  if(err && err.response && err.response.data) {
    console.log(`User transferAssetOfDeleteduser err ==> ${req.params.userId}  ==>`, JSON.stringify(err.response.data));
  }
  const errCode = userMessages.DELETE.OWNERSHIP_TRANSFER_FAIL;
  rspObj.errCode = userMessages.DELETE.FAILED_CODE;
  rspObj.errMsg = userMessages.DELETE.FAILED_MESSAGE
  rspObj.responseCode = responseCode.SERVER_err
  rspObj.result  = err;
  loggerError(rspObj, errCode);
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  return response.status(400).send(errorResponse(rspObj,errCode))
}



function onIndividualUserDeletion (req, response, userDetails) {
  const eventData = generateDeleteUserEvent (req, response, userDetails, []);
  try {
  KafkaService.sendRecordWithTopic(eventData, envVariables.COKREAT_USER_DELETE_KAFKA_TOPIC, function (err, res) {
    if (err) {
      throw(err);
    } else {
      handleUserDeleteSuccess(req, response, {"response": 'User deleted Successfully ${req.params.userId}'});
    }
  });
 }catch(err) {
  handleUserDeleteError(req, response, error);

 }
}

function onOrgUserDeletion(req, response, userDetails) {      
  userDetails.orgs.every((element)=> {
    if (element.roles.includes("user")) {
      searchAdminOfOrg(element.osid, (error, res) => {
        if (res && res.status == 200) {
          if (res.data.result.User_Org.length > 0) {
            var adminUserOrgDetails = res.data.result.User_Org[0];
            if (adminUserOrgDetails.userId) {
              searchOSUserWithOsId(adminUserOrgDetails.userId, (adminErr, adminRes) => {
                if (adminRes && adminRes.status == 200 && adminRes.data.result.User.length > 0) {
                  var adminDetails = adminRes.data.result.User[0];
                  const eventData =  generateDeleteUserEvent (req, response, userDetails, [{role: 'admin', users: [adminDetails.userId]}]);
                  KafkaService.sendRecordWithTopic(eventData, envVariables.COKREAT_USER_DELETE_KAFKA_TOPIC, function (err, res) {
                    if (err) {
                      handleUserDeleteError(req, response, error);
                    } else {
                      handleUserDeleteSuccess(req, response, 'User deleted Successfully ${req.params.userId}');
                    }
                  });
                } else {
                  handleUserDeleteError(req, response, adminErr)
                }
              });
            }
          } else {
            handleUserDeleteError(req, response, {"response": "Admin for the org not found"});
          }
        } else {
          handleUserDeleteError(req, response, error);
        }
      });
      return false;
    }
  });
}

module.exports = { getSunbirdUserProfiles, deleteUser, transferAssetOfDeleteduser }

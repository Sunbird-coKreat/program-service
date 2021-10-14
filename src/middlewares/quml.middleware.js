var respUtil = require('response_util')
var messageUtil = require('../service/messageUtil')
const loggerService = require("../service/loggerService");
var logger = require('sb_logger_util_v2')
var reqMsg = messageUtil.REQUEST
var responseCode = messageUtil.RESPONSE_CODE
var _ = require('lodash')
var uuidV1 = require('uuid/v1')

function validateRequestBody (req, res, next) {
  logger.debug({ msg: 'validateRequestBody() called' }, req)
  const logObject = {
    traceId : req.headers['x-request-id'] || uuidV1(),
    message : reqMsg.QUML_REQ.INFO
   }
  loggerService.entryLog(req.body, logObject);
  var questionCategory = req.query.questionCategory ? req.query.questionCategory : req.body.questionCategory;
  var file = req.files;
  console.log("questionCategory", questionCategory);
  var rspObj = req.rspObj
  if (_.isEmpty(questionCategory) || _.isEmpty(file)) {
    rspObj.errCode = reqMsg.QUML_REQ.MISSING_CODE
    rspObj.errMsg = reqMsg.QUML_REQ.MISSING_MESSAGE
    rspObj.responseCode = responseCode.CLIENT_ERROR
    logger.error({
      msg: 'API failed due to missing file or question_category',
      err: {
        errCode: rspObj.errCode,
        errMsg: rspObj.errMsg,
        responseCode: rspObj.responseCode
      }
    }, req)
    loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
    return res.status(400).send(respUtil.errorResponse(rspObj))
  }
  logger.debug({ msg: `question category = ${questionCategory}` })
  next()
}

// Exports required function
module.exports.validateRequestBody  = validateRequestBody
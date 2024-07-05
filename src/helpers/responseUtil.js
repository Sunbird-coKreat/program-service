const logger = require('sb_logger_util_v2');
const uuid = require("uuid/v1");
const stackTrace_MaxLimit = 500;
const _ = require('lodash');
const messageUtils = require('../service/messageUtil');
const responseCode = messageUtils.RESPONSE_CODE;
const loggerService = require('../service/loggerService');


const successResponse = (data) => {
  var response = {}
  response.id = data.apiId
  response.ver = data.apiVersion
  response.ts = new Date()
  response.params = getParams(data.msgid, data.resmsgid, 'successful', null, null)
  response.responseCode = data.responseCode || responseCode.SUCCESS
  response.result = data.result || {}
  return response
}
const errorResponse = (data) => {
  var response = {}
  response.id = data.apiId
  response.ver = data.apiVersion
  response.ts = new Date()
  response.params = getParams(data.msgid, data.resmsgid, 'failed', data.errCode, data.errMsg)
  response.responseCode = data.responseCode
  response.result = data.result || {};
  return response
}

const responseObject = (data) => {
  var response = {}
  const responseStatus = (data.errCode) ? 'failed' : 'successfull'
  const errorCode = data.errCode || null
  const errMsg = data.errMsg || null
  response.id = data.apiId
  response.ver = data.apiVersion
  response.ts = new Date()
  response.params = getParams(data.msgid, data.resmsgid, responseStatus, errorCode, errMsg)
  response.responseCode = data.responseCode
  response.result = data.result || {};
  return response
}
const handleSuccessResponse = (req, response, logObject) => {
  var rspObj = req.rspObj
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  return response.status(200).send(responseObject(rspObj));
}

const handleErrorResponse = (req, response, logObject, error) => {
  var rspObj = req.rspObj
  console.log(`${rspObj.apiId}`, JSON.stringify(error))
  if(error && error.response && error.response.data) {
    console.log(`${rspObj.apiId}`, JSON.stringify(error.response.data));
  }
  const statusCode = rspObj.statusCode || 500;
  rspObj.responseCode = rspObj.responseCode || responseCode.SERVER_ERROR;
  loggerError(rspObj, rspObj.errCode);
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  return response.status(statusCode).send(responseObject(rspObj));
}

const getParams = (msgId = null, resmsgId = null, status, errCode, msg) => {
  var params = {}
  params.resmsgid = resmsgId;
  params.msgid = msgId;
  params.status = status;
  params.err = errCode;
  params.errmsg = msg;
  return params;
}

const loggerError = (data,errCode) => {
  var errObj = {}
  errObj.eid = 'Error'
  errObj.edata = {
    err : errCode,
    errtype : data.errMsg,
    requestid : data.resmsgid || uuid(),
    stacktrace : _.truncate(JSON.stringify(data), { 'length': stackTrace_MaxLimit})
  }
  logger.error({msg: 'Error log', errObj})
}

module.exports = {
  successResponse,
  errorResponse,
  getParams,
  loggerError,
  handleSuccessResponse,
  handleErrorResponse
}

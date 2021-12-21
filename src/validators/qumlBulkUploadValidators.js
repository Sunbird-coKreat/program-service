const { body, validationResult } = require('express-validator');
var _ = require('lodash')
const messageUtils = require('../service/messageUtil');
const programMessages = messageUtils.PROGRAM;
const errorCodes = messageUtils.ERRORCODES;
const loggerService = require('../service/loggerService');
const responseCode = messageUtils.RESPONSE_CODE;
const { errorResponse, loggerError } = require('../helpers/responseUtil');

const qumlBulkUpload = () => {
  return [
    body('request').exists().withMessage('request object is missing'),
    body('request.fileUrl')
      .isString().withMessage('Metadata fileUrl should be a/an string value')
      .notEmpty().withMessage('Required Metadata fileUrl should not be empty'),
    body('request.questionType')
      .isString().withMessage('Metadata questionType should be a/an string value')
      .exists().withMessage('Required Metadata questionType not set')
      .isIn(['MCQ']).withMessage('Metadata questionType should be one of: [MCQ]'),
    body('request.status')
      .optional()
      .isString().withMessage('Metadata status should be a/an string value')
      .isIn(['Live', 'Review', 'Draft']).withMessage('Metadata status should be one of: [Live, Review, Draft]'),
    body('request.questionSetId')
      .optional()
      .isString().withMessage('Metadata questionSetId should be a/an string value')
      .notEmpty().withMessage('Required Metadata questionSetId should not be empty'),
  ]
}

const validate = (req, res, next) => {
  const rspObj = req.rspObj;
  const errCode = programMessages.EXCEPTION_CODE+'_'+ programMessages.QUML_BULKUPLOAD.EXCEPTION_CODE
  const logObject = {
    traceId : req.headers['x-request-id'] || '',
    message : programMessages.QUML_BULKUPLOAD.INFO
   }
  loggerService.entryLog(req.body, logObject);
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next()
  }
  const extractedErrors = []; 
  errors.array().map(err => extractedErrors.push(err.msg))
  rspObj.errCode = responseCode.CLIENT_ERROR;
  rspObj.errMsg = programMessages.QUML_BULKUPLOAD.VALIDATION_MESSAGE;
  rspObj.result = { messages: extractedErrors };
  rspObj.responseCode = responseCode.CLIENT_ERROR;
  loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
  loggerError(rspObj,errCode+errorCodes.CODE1)
  return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE1));
}

module.exports = {
  qumlBulkUploadValidator : qumlBulkUpload,
  validate
}
const fs = require("fs");
const fetch = require("node-fetch");
const _ = require("lodash");
const { v4: uuidv4 } = require("uuid");
const KafkaService = require("../helpers/kafkaUtil");
const { errorResponse, loggerError, successResponse } = require('../helpers/responseUtil');
const CSVFileValidator = require("../helpers/csv-helper-util");
const logger = require("sb_logger_util_v2");
const loggerService = require("./loggerService");
const messageUtils = require("./messageUtil");
const responseCode = messageUtils.RESPONSE_CODE;
const programMessages = messageUtils.PROGRAM;
const errorCodes = messageUtils.ERRORCODES;
const envVariables = require("../envVariables");
const csv = require("express-csv");
let bulkUploadErrorMsgs;
let allowedDynamicColumns = [];
const bulkUploadConfig = {
  maxRows: 300,
};
const max_options_limit = 4;
let uploadCsvConfig;
const QS_HIERARCHY_READ_URL = `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/questionset/v4/hierarchy/`;
const bulkUpload = async (req, res) => {
  bulkUploadErrorMsgs = []
  const rspObj = req.rspObj
  const reqHeaders = req.headers;
  const logObject = {
    traceId: req.headers["x-request-id"] || "",
    message: programMessages.QUML_BULKUPLOAD.INFO,
  };  
  let pId = uuidv4();
  let qumlData;
  setBulkUploadCsvConfig();
  const csvFileURL = _.get(req, 'body.request.fileUrl', null);
  loggerService.entryLog("Api to upload questions in bulk", logObject);
  const errCode = programMessages.EXCEPTION_CODE+'_'+programMessages.QUML_BULKUPLOAD.EXCEPTION_CODE
  logger.info({ message: "Qeustionset ID ===>", questionSetID: _.get(req, 'body.request.questionSetId', null)});
  getQuestionSetHierarchy(_.get(req, 'body.request.questionSetId'), reqHeaders, (err, data) => {
    if(err) {
      console.log('Error fetching hierarchy for questionSet ======> ', JSON.stringify(err));
      rspObj.errCode = _.get(err, 'params.err') || programMessages.QUML_BULKUPLOAD.HIERARCHY_FAILED_CODE;
      rspObj.errMsg = _.get(err, 'params.errmsg') || programMessages.QUML_BULKUPLOAD.HIERARCHY_FAILED_MESSAGE;
      rspObj.responseCode = _.get(err, 'responseCode') || responseCode.SERVER_ERROR;
      loggerError(rspObj,errCode+errorCodes.CODE2);
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE2));
    }
    const flattenHierarchyObj=  getFlatHierarchyObj(data);
    const csvValidator = new CSVFileValidator(uploadCsvConfig, allowedDynamicColumns, flattenHierarchyObj);
    csvValidator.validate(csvFileURL).then((csvData) => {
      if (!_.isEmpty(bulkUploadErrorMsgs)) {
        rspObj.errCode = programMessages.QUML_BULKUPLOAD.MISSING_CODE;
        rspObj.errMsg = programMessages.QUML_BULKUPLOAD.MISSING_MESSAGE;
        rspObj.responseCode = responseCode.CLIENT_ERROR;
        rspObj.result = { messages: bulkUploadErrorMsgs };
        loggerError(rspObj,errCode+errorCodes.CODE3);
        loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
        return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE3));
      }
      qumlData = csvData.data;
      const questionsArr = [];
      _.forEach(qumlData, (question) => {
        question = prepareQuestionData(question, req);
        question['questionSetSectionId'] = flattenHierarchyObj[question.level1];
        question["processId"] = pId;
        console.log("Prepared Question body : =====>", JSON.stringify(question))
        questionsArr.push(question);
      });
      sendRecordToKafkaTopic(questionsArr);
      logger.info({ message: "Bulk Upload process has started successfully for the process Id", pId});
      rspObj.responseCode = responseCode.SUCCESS;
      rspObj.result = { processId: pId, count: qumlData.length};
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(200).send(successResponse(rspObj))
    }).catch(err => {
      console.log('Error while validating the CSV file =====> ', JSON.stringify(err));
      rspObj.errCode = programMessages.QUML_BULKUPLOAD.FAILED_CODE;
      rspObj.errMsg = programMessages.QUML_BULKUPLOAD.FAILED_MESSAGE;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      loggerError(rspObj,errCode+errorCodes.CODE3);
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE3));
    });
  })
};

const sendRecordToKafkaTopic = (question) => {
  const errCode = programMessages.EXCEPTION_CODE+'_'+programMessages.QUML_BULKUPLOAD.EXCEPTION_CODE
  KafkaService.sendRecordWithTopic(question, envVariables.SUNBIRD_QUESTION_BULKUPLOAD_TOPIC,
    (err, response) => {
      if (err) { 
        logger.error(
          {
            message: "Something Went wrong while producing kafka event",
            errorData: err,
          },
          errCode+errorCodes.CODE4
        );
      }
      console.log('sendRecordWithTopic :: SUCCESS :: ', response);
    }
  );
}

const setBulkUploadCsvConfig = () => {
  const headerError = (headerName) => {
    setError(`${headerName} header is missing.`);
  };
  const requiredError = (headerName, rowNumber, columnNumber) => {
    setError(`${headerName} value is missing at row: ${rowNumber}`);
  };
  const uniqueError = (headerName, rowNumber, columnNumber, value) => {
    setError(`${headerName} has duplicate value at row: ${rowNumber}`);
  };
  const inError = (headerName, rowNumber, columnNumber, acceptedValues, value) => {
    setError(`${headerName} has invalid value at row: ${rowNumber}`);
  };
  const urlError = (headerName, rowNumber, columnNumber, value) => {
    setError(`${headerName} has invalid url value at row: ${rowNumber}`);
  };

  const specialCharError = (headerName, rowNumber, columnNumber, value) => {
    setError(`${headerName} has special character value at row: ${rowNumber}`);
  };

  const maxLengthError = (headerName, rowNumber, columnNumber, maxLength, length) => {
    setError(`Length of ${headerName} exceeds ${maxLength}. Please give a shorter ${headerName} at row: ${rowNumber}`);
  };
  const extraHeaderError = (invalidColumns, expectedColumns, foundColumns) => {
    setError(`Invalid data found in columns: ${invalidColumns.join(',')}`);
  };

  const maxRowsError = (maxRows, actualRows) => {
    setError(`Expected max ${maxRows} rows but found ${actualRows} rows in the file`);
  };
  const noRowsError = () => {
    setError(`Empty rows in the file`);
  };

  const headers = [
    { name: 'Name of the Question', inputName: 'name', isSpecialChar: true, maxLength: 120, required: true, requiredError, headerError, maxLengthError, specialCharError },
    { name: 'QuestionText', inputName: 'questionText', headerError, maxLength: 1000, maxLengthError },
    { name: 'QuestionImage', inputName: 'questionImage', headerError, isUrl: true, urlError},
    { name: 'Option Layout', inputName: 'optionLayout', required: true, requiredError, headerError, in: ['1', '2', '3'], inError },
    { name: 'Option1', inputName: 'option1', headerError, maxLength: 1000, maxLengthError },
    { name: 'Option1Image', inputName: 'option1Image', headerError, isUrl: true, urlError},
    { name: 'Option2', inputName: 'option2', headerError, maxLength: 1000, maxLengthError },
    { name: 'Option2Image', inputName: 'option2Image', headerError, isUrl: true, urlError},
    { name: 'Option3', inputName: 'option3', headerError, maxLength: 1000, maxLengthError },
    { name: 'Option3Image', inputName: 'option3Image', headerError},
    { name: 'Option4', inputName: 'option4', headerError, maxLength: 1000, maxLengthError },
    { name: 'Option4Image', inputName: 'option4Image', headerError},
    { name: 'AnswerNo', inputName: 'answerNo', required: true, requiredError, headerError },
    { name: 'Level 1 Question Set Section', inputName: 'level1', headerError },
    { name: 'Keywords', inputName: 'keywords', isSpecialChar: true, isArray: true, headerError, specialCharError },
    { name: 'Author', inputName: 'author',isSpecialChar: true, headerError, maxLength: 300, maxLengthError, specialCharError },
    { name: 'Copyright', inputName: 'copyright',isSpecialChar: true, headerError, maxLength: 300, maxLengthError, specialCharError },
    { name: 'Attributions', inputName: 'attributions',isSpecialChar: true, isArray: true, headerError, maxLength: 300, maxLengthError, specialCharError }
  ];

  const validateRow = (row, rowIndex, flattenHierarchyObj) => {
    if (_.isEmpty(row.questionText) && _.isEmpty(row.questionImage)) {
      const name = headers.find((r) => r.inputName === 'questionText').name || '';
      setError(`${name} is missing at row: ${rowIndex}`);
    }

    const options = [];
    _.forEach(_.range(max_options_limit), (opt, index) => {
      let optionValue = row[`option${index + 1}`] || '';
      let optionImage = row[`option${index + 1}Image`] || '';
      if(!_.isEmpty(optionValue) || !_.isEmpty(optionImage)) {
        options.push({optionValue, optionImage});
      }
    });

    if(_.size(options)  === 0 ) {
      setError(`Options are empty at row: ${rowIndex}`);
    } else if(_.size(options) < 2 ) {
      setError(`Minimum two options are required at row: ${rowIndex}`);
    }

    if(!_.includes(_.range(_.size(options), 0), _.toNumber(row.answerNo))) {
      setError(`Answer number not valid at row: ${rowIndex}`);
    }

    if (!_.isEmpty(row.level1) && !_.has(flattenHierarchyObj, row.level1)) {
      const name = headers.find((r) => r.inputName === 'level1').name || '';
      setError(`${name} is invalid at row: ${rowIndex}`);
      return;
    }

  };

  uploadCsvConfig = {
    headers: headers,
    maxRows: bulkUploadConfig.maxRows,
    validateRow,
    maxRowsError,
    noRowsError,
    extraHeaderError
  };
}

const setError = (message) => {
  bulkUploadErrorMsgs.push(message);
}

const prepareQuestionData = (questionMetadata, req) => {
  const requestedProperties = ['additionalCategories', 'board', 'medium', 'gradeLevel', 'subject', 'audience',
                  'license', 'framework', 'topic','status', 'createdBy', 'questionType', 'questionSetId'];
  questionMetadata['questionFileRefId'] = uuidv4();
  questionMetadata['channel'] = req.get('x-channel-id');
  questionMetadata = _.merge({}, questionMetadata, _.pick(req.body.request, requestedProperties));
  if(_.isEmpty(questionMetadata, 'author')) {
    questionMetadata['author'] =  _.get(req.body.request, 'author');
  }
  if(!_.has(questionMetadata, 'status')) {
    questionMetadata['status'] = 'Live';
  }
  return questionMetadata;
}

//question search API function;
const qumlSearch = (req, res) => {
  const rspObj = req.rspObj
  const searchData =  {
    "request": { 
        "filters":{
            "objectType":"Question",
            "status":[],
            "processId":req.body.request.processId
        },
        "fields":[
          "identifier","processId","author","name","status","primaryCategory","questionUploadStatus","code","questionFileRefId",
          'additionalCategories', 'board', 'medium', 'gradeLevel', 
          'subject', 'topic', 'learningOutcome','skill','keywords','audience','copyright', 'license', 'attributions',
          'channel', 'framework', 'createdBy', 'createdOn', 'qType'
        ],
        "limit":1000
    }
}
  const logObject = {
    traceId: req.headers["x-request-id"] || "",
    message: programMessages.QUML_BULKSTATUS.INFO,
  };
  loggerService.entryLog("Api to check the status of bulk upload question", logObject);
  const errCode = programMessages.EXCEPTION_CODE+'_'+programMessages.QUML_BULKSTATUS.EXCEPTION_CODE
  fetch(`${envVariables.baseURL}/action/composite/v3/search`, {
    method: "POST", // or 'PUT'
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchData),
  })
    .then((response) => response.json())
    .then(async(resData) => {
      rspObj.responseCode = resData.responseCode || responseCode.SUCCESS;
      rspObj.result = { ...resData.result  }
      logger.info({ message: "Successfully Fetched the data", rspObj });
      loggerService.exitLog(
      "Successfully got the Questions",
        rspObj,
      );    
      return res.status(200).send(successResponse(rspObj))
    })
    .catch((error) => {
      console.log('Error while fetching the question :: =====> ', JSON.stringify(error));
      rspObj.errCode = programMessages.QUML_BULKSTATUS.FAILED_CODE;
      rspObj.errMsg = programMessages.QUML_BULKSTATUS.FAILED_MESSAGE;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      loggerError(rspObj,errCode+errorCodes.CODE1);
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE1));
    });
};

//Read QuestionSet Hierarchy function;
const getQuestionSetHierarchy = (questionSetId,reqHeaders,  callback) => {
  if (_.isEmpty(questionSetId)) { return callback(null, {}); }
  fetch(`${QS_HIERARCHY_READ_URL}${questionSetId}?mode=edit`, {
    method: "GET",
    headers: reqHeaders
  })
  .then((response) => response.json())
  .then((readResponseData) => {
    if (readResponseData.responseCode && _.toLower(readResponseData.responseCode) === "ok") {
      callback(null, readResponseData.result.questionSet);
    } else {
      callback(readResponseData);
    }
  })
  .catch((error) => {
    logger.error({
      message: `Something Went Wrong While fetching the questionset hierarchy ${error}`,
    });
    callback(error);
  });
};

const getFlatHierarchyObj = (data, hierarchyObj = {}) => {
  if (!_.isEmpty(data)) {
    hierarchyObj[data.name] = data.identifier;
  }
  _.forEach(data.children, child => {
    if (child.mimeType === "application/vnd.sunbird.questionset" && child.visibility === 'Parent') {
      getFlatHierarchyObj(child, hierarchyObj);
    }
  });
  return hierarchyObj;
}

module.exports = {
  bulkUpload,
  qumlSearch
};
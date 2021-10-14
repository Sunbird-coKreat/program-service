const fs = require("fs");
const fetch = require("node-fetch");
const _ = require("lodash");
const { v4: uuidv4 } = require("uuid");
const KafkaService = require("../helpers/kafkaUtil");
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
const stackTrace_MaxLimit = 500;
const max_options_limit = 4;
let uploadCsvConfig;

const bulkUpload = async (req, res) => {
  bulkUploadErrorMsgs = []
  const rspObj = req.rspObj
  const logObject = {
    traceId: req.headers["x-request-id"] || "",
    message: programMessages.QUML_BULKUPLOAD.INFO,
  };  
  let pId = uuidv4();
  let qumlData;
  setBulkUploadCsvConfig();
  const unparseData = req.files.File.data.toString('utf8');
  loggerService.entryLog("Api to upload questions in bulk", logObject);
  const errCode = programMessages.EXCEPTION_CODE+'_'+programMessages.QUML_BULKUPLOAD.EXCEPTION_CODE
  logger.info({ message: "Qeustionset ID ===>", questionSetID: req.params.questionset_id });
  const questionCategory = req.query.questionCategory ? req.query.questionCategory : req.body.questionCategory;
  getQuestionSetHierarchy(req.params.questionset_id, (err, data) => {
    if(err) {
      rspObj.errCode = programMessages.QUML_BULKUPLOAD.HIERARCHY_FAILED_CODE;
      rspObj.errMsg = programMessages.QUML_BULKUPLOAD.HIERARCHY_FAILED_MESSAGE;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      loggerError(rspObj,errCode+errorCodes.CODE1);
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE1));
    }
    const flattenHierarchyObj=  getFlatHierarchyObj(data);
    console.log("flattenHierarchyObj ====> ", flattenHierarchyObj);
    const csvValidator = new CSVFileValidator(uploadCsvConfig, allowedDynamicColumns, flattenHierarchyObj);
    csvValidator.validate(unparseData).then((csvData) => {
      if (!_.isEmpty(bulkUploadErrorMsgs)) {
        rspObj.errCode = programMessages.QUML_BULKUPLOAD.MISSING_CODE;
        rspObj.errMsg = programMessages.QUML_BULKUPLOAD.MISSING_MESSAGE;
        rspObj.responseCode = responseCode.CLIENT_ERROR;
        rspObj.result = { errors: bulkUploadErrorMsgs };
        loggerError(rspObj,errCode+errorCodes.CODE2);
        loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
        return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE2));
      }
      qumlData = csvData.data;
      _.forEach(qumlData, (question) => {
        question = prepareQuestionData(question, data);
        question['questionCategory'] = questionCategory;
        question['questionSetSectionId'] = flattenHierarchyObj[question.level1];
        question["processId"] = pId;
        sendRecordToKafkaTopic(question);
      });
      const createdResponse = {
        process_id: pId,
        questionStatus: `Bulk Upload process has started successfully for the process Id : ${pId}`,
        "Total no of questions": qumlData.length,
      };
      logger.info({ message: "Bulk Upload process has started successfully for the process Id", pId});
      rspObj.responseCode = responseCode.SUCCESS;
      rspObj.result = createdResponse;
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(200).send(successResponse(rspObj))
    }).catch(err => {
      console.error(err);
      rspObj.errCode = programMessages.QUML_BULKUPLOAD.FAILED_CODE;
      rspObj.errMsg = programMessages.QUML_BULKUPLOAD.FAILED_MESSAGE;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      loggerError(rspObj,errCode+errorCodes.CODE2);
      loggerService.exitLog({responseCode: rspObj.responseCode}, logObject);
      return res.status(400).send(errorResponse(rspObj,errCode+errorCodes.CODE2));
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
            message: "Something Went wrong while producing kafka",
            errorData: err,
          },
          errCode+errorCodes.CODE2
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
    { name: 'Name of the Question', inputName: 'name', maxLength: 120, required: true, requiredError, headerError, maxLengthError },
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
    { name: 'Level 1 Question Set Section', inputName: 'level1', required: true, requiredError, headerError },
    { name: 'Keywords', inputName: 'keywords', isArray: true, headerError },
    { name: 'Author', inputName: 'author',headerError, maxLength: 300, maxLengthError },
    { name: 'Copyright', inputName: 'copyright',headerError, maxLength: 300, maxLengthError },
    { name: 'License', inputName: 'license', headerError, maxLength: 300, maxLengthError },
    { name: 'Attributions', inputName: 'attributions', isArray: true, headerError, maxLength: 300, maxLengthError }
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

    if (!_.has(flattenHierarchyObj, row.level1)) {
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

const prepareQuestionData = (questionMetadata, questionSetMetadata) => {
  const derivedProperties = ['additionalCategories', 'board', 'medium', 'gradeLevel', 'subject', 'audience',
                             'license', 'framework', 'channel', 'topic']
  questionMetadata = _.merge({}, questionMetadata, _.pick(questionSetMetadata, derivedProperties))
  questionMetadata['questionSetId'] = _.get(questionSetMetadata, 'identifier');
  questionMetadata['questionFileRefId'] = uuidv4();
  return questionMetadata;
}

//question search API function;
const qumlSearch = (req, res) => {
  const searchData =  {
    "request": { 
        "filters":{
            "objectType":"Question",
            "status":[],
            "processId":req.body.processId
        },
        "fields":["identifier","processId","author","name","status","primaryCategory","questionUploadStatus","code","questionFileRefId"],
        "limit":1000
    }
}
  const logObject = {
    traceId: req.headers["x-request-id"] || "",
    message: programMessages.QUML_BULKSTATUS.INFO,
  };
  loggerService.entryLog("Api to check the status of bulk upload question", logObject);
  fetch(`${envVariables.baseURL}/action/composite/v3/search`, {
    method: "POST", // or 'PUT'
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchData),
  })
    .then((response) => response.json())
    .then(async(resData) => {
      rspObj.responseCode = "OK";
      rspObj.result = {
        questionStatus: `Successfully fetched the data for the given request: ${searchData}`,
      };
      logger.info({ message: "Successfully Fetched the data", rspObj });
      res.csv(resData.result.Question)
    loggerService.exitLog(
     "Successfully got the Questions",
      rspObj,
    );    
    })
    .catch((error) => {
      rspObj.errMsg = "Something went wrong while fetching the data";
      rspObj.responseCode = responseCode.SERVER_ERROR;
      logger.error(
        {
          message: "Something went wrong while fetching the data",
          errorData: error,
          rspObj,
        },
        errorCodes.CODE2
      );
      res
        .status(400)
        .send(
          {
            message: "Something went wrong while fetching the data",
            errorData: error,
            rspObj,
          },
          errorCodes.CODE2
        );
    });
};

//Read QuestionSet Hierarchy function;
const getQuestionSetHierarchy = (questionSetId, callback) => {
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/questionset/v1/hierarchy/${questionSetId}?mode=edit`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
    }
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
    console.error("Error:", error);
    logger.error({
      message: `Something Went Wrong While fetching the questionset hierarchy ${error}`,
    });
    callback(error);
  });
};

const getFlatHierarchyObj = (data, hierarchyObj = {}) => {
  if (data) {
    hierarchyObj[data.name] = data.identifier;
  }
  _.forEach(data.children, child => {
    if (child.mimeType === "application/vnd.sunbird.questionset" && child.visibility === 'Parent') {
      getFlatHierarchyObj(child, hierarchyObj);
    }
  });
  return hierarchyObj;
}

function successResponse(data) {
  var response = {}
  response.id = data.apiId
  response.ver = data.apiVersion
  response.ts = new Date()
  response.params = getParams(data.msgid, 'successful', null, null)
  response.responseCode = data.responseCode || 'OK'
  response.result = data.result
  return response
}

function errorResponse(data,errCode) {
  var response = {}
  response.id = data.apiId
  response.ver = data.apiVersion
  response.ts = new Date()
  response.params = getParams(data.msgId, 'failed', data.errCode, data.errMsg)
  response.responseCode = errCode + '_' + data.responseCode
  response.result = data.result
  return response
}

function getParams(msgId, status, errCode, msg) {
  var params = {}
  params.resmsgid = uuidv4()
  params.msgid = msgId || null
  params.status = status
  params.err = errCode
  params.errmsg = msg

  return params
}

function loggerError(errmsg,data,errCode) {
  var errObj = {}
  errObj.eid = 'Error'
  errObj.edata = {
    err : errCode,
    errtype : errmsg || data.errMsg,
    requestid : data.msgId || uuidv4(),
    stacktrace : _.truncate(JSON.stringify(data), { 'length': stackTrace_MaxLimit})
  }
  logger.error({ msg: 'Error log', errObj})
}

module.exports = {
  bulkUpload,
  qumlSearch
};

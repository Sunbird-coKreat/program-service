const fs = require("fs");
var kafka = require("kafka-node");
var FormData = require('form-data');
const fetch = require("node-fetch");
const logger = require("sb_logger_util_v2");
const { v4: uuidv4 } = require("uuid");
const messageUtils = require("../service/messageUtil");
const GoogleOauth  = require("../helpers/googleOauthHelper");
const responseCode = messageUtils.RESPONSE_CODE;
const errorCodes = messageUtils.ERRORCODES;
const envVariables = require("../envVariables");
const async = require('async');
const _ = require("lodash");
const templateClassMap = {
  "1" : 'mcq-vertical',
  "2" : 'mcq-vertical-split',
  "3" : 'mcq-horizontal'
}
const allowedMimeType = ['image/jpeg', 'image/png'];
const total_options = 4;
const API_URL = {
  ASSET_CREATE: "asset/v4/create",
  ASSET_UPLOAD: "asset/v4/upload/",
  QUESTION_CREATE: "/question/v4/create",
  QUESTION_REVIEW: "/question/v4/review/",
  QUESTION_PUBLISH: "/question/v4/publish/",
  QUESTION_UPDATE: "/question/v4/update/",
  QUESTION_RETIRE: "/question/v4/retire/",
  QUESTIONSET_ADD: "/questionset/v4/add",
}
const questionTypeMap = {
  'mcq': "Multiple Choice Question"
}
const rspObj = {};

const qumlConsumer = () => {
  try {
    Consumer = kafka.Consumer;
    ConsumerGroup = kafka.ConsumerGroup;
    client = new kafka.KafkaClient({
      kafkaHost: envVariables.DOCK_KAFKA_HOST,
    });
    payload = [
      {
        topic: envVariables.SUNBIRD_QUESTION_BULKUPLOAD_TOPIC,
        partition: 1,
      },
    ];

    var options = {
      kafkaHost: envVariables.DOCK_KAFKA_HOST,
      groupId: envVariables.SUNBIRD_KAFKA_BULKUPLOAD_CONSUMER_GROUP_ID,
      fromOffset: "latest",
    };
    var consumerGroup = new ConsumerGroup(options, [
      envVariables.SUNBIRD_QUESTION_BULKUPLOAD_TOPIC
    ]);
    consumerGroup.on("message", function (message) {
        logger.info({ message: "Entered into the consumer service" });
        let parsedJsonValue = JSON.parse(message.value);;
        console.log("Kafka consumer :: =====> ", JSON.stringify(parsedJsonValue));
        initQuestionCreateProcess(parsedJsonValue);
      }).on("error", function (message) {
        client.close();
      });
  } catch (error) {
    logger.error(
      {
        message: `Something Went Wrong While Creating the question ${error}`,
      },
      error
    );
  }
};

const initQuestionCreateProcess = (questions) => {
  logger.info({ message: "Question creating process started" });
  async.eachSeries(questions,function(questionData, cb){
    async.waterfall([
      async.apply(createQuestion, questionData),
      async.apply(startDownloadFileProcess, questionData),
      async.apply(prepareQuestionBody),
      async.apply(updateQuestion),
      async.apply(reviewQuestion, questionData.status),
      async.apply(publishQuestion, questionData.status),
      async.apply(linkQuestionToQuestionSet, questionData)
    ], function (err, result) {
        cb();
        if(err) { 
          return logger.error(
            {
              message: `Something Went Wrong While Creating the question ${JSON.stringify(err)}`,
            },
            err
          ); 
        }
        console.log('initQuestionCreateProcess :: SUCCESS :: =====> ', JSON.stringify(result));
    });
  }, function(err){
    logger.info({ message: "Question creating process completed!" });
  });
};

const createQuestion = (questionData, callback) => {
  const questionType  = questionData.questionType.toLowerCase();
  let createApiData = {
    "request": {
        "question": {
          "code" : uuidv4(),
          "name": questionData.name ? questionData.name : questionTypeMap[questionType],
          "mimeType": 'application/vnd.sunbird.question',
          "primaryCategory": questionTypeMap[questionType],
          "questionFileRefId": questionData.questionFileRefId,
          "processId": questionData.processId
      }
    }
  };
  console.log('createQuestionBody:: =====> ' , JSON.stringify(createApiData));
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_CREATE}`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(createApiData),
    })
    .then((response) => response.json())
    .then((createResponseData) => {
      console.log('createQuestion response :: =====> ' , JSON.stringify(createApiData));
      if (createResponseData.responseCode && _.toLower(createResponseData.responseCode) === "ok") {
        callback(null, createResponseData);
      } else {
        callback(createResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while creating the question ::  ${JSON.stringify(error)}`,
      });
      callback(error);
  });

}

const startDownloadFileProcess = (question, createQuestionRes, outerCallback) => {
  const filesToDownload = _.omitBy(_.pick(question, ['questionImage','option1Image', 'option2Image', 'option3Image', 'option4Image']), _.isEmpty);
  if(_.isEmpty(filesToDownload)) {
    return outerCallback(null, question, createQuestionRes);
  }
  const downloadedFiles = {};
  async.eachOfSeries(filesToDownload, function (data, key, callback) {
    const fileId = getIdFromUrl(data);
    if(_.has(downloadedFiles,fileId)) {
      question[key] = _.get(downloadedFiles,fileId);
      console.log(key, " :: File already downloaded :: =====> ", JSON.stringify(data))
      callback(null, 'File');
    } else {
      async.waterfall([
        async.apply(downloadFile, data),
        async.apply(validateFileType),
        async.apply(createAssest, question),
        async.apply(uploadAsset),
        async.apply(deleteFileFromTemp),
      ], function (err, result) {
          if(err) { 
            return callback(err); 
          }
          downloadedFiles[fileId] = result.artifactUrl;
          question[key] = result.artifactUrl;
          callback(null, result);
      });
    }
  }, function (error) {
    console.log(" startDownloadFileProcess :: error ::", JSON.stringify(error));
    if (error) {
      updateResponse(
        createQuestionRes.result.identifier,
        `Something went wrong while downloading the files from google drive: ${JSON.stringify(error)}`
      );
      outerCallback(error);
    } else {
      outerCallback(null, question, createQuestionRes);
    }
  });
}

const downloadFile = (data, callback) => {
  const googleAuth =  new GoogleOauth();
  const fileId = getIdFromUrl(data);
  googleAuth.downloadFile(fileId).then((result) => {
    console.log("RESULT :: =====> ", JSON.stringify(result));
    callback(null, result);
  }).catch((error) => {
    console.log("downloadFile Func error: ", JSON.stringify(error));
    if(error.errors || error.response) {
      callback(error.errors || _.pick(error.response, ['status', 'statusText', 'request']));
    } else {
      callback(error);
    }
  })
}

const validateFileType = (data, callback) => {
  if(allowedMimeType.includes(data.mimeType)) {
    callback(null, data);
  } else {
    callback('Invalid image format! Image format must be JPG or PNG');
  }
}

const createAssest = (question, data, callback) => {
  const extension = path.extname(data.name);  
  const filename = path.basename(data.name, extension);
  const mediaType = _.first(_.split(data.mimeType, '/'));
    let reqBody = {
      "request": {
          "asset": {
              "name": filename,
              "code":uuidv4(),
              "mimeType": data.mimeType,
              "primaryCategory": "asset",
              "mediaType": mediaType
          }
      }
  };
  console.log("createAssest request Body =====> ", JSON.stringify(reqBody));
  fetch(`${envVariables.CONTENT_SERVICE_URL}${API_URL.ASSET_CREATE}`, {
      method: "POST", // or 'PUT'
      headers: {
        "X-Channel-ID": question.channel,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reqBody),
    })
    .then((response) => response.json())
    .then((assetResponseData) => {
      console.log("createAssest response =====> ", JSON.stringify(assetResponseData));
      if (assetResponseData.responseCode && _.toLower(assetResponseData.responseCode) === "ok") {
        data['identifier'] = assetResponseData.result.identifier;
        callback(null, data);
      } else {
        callback(assetResponseData);
      }
    })
    .catch((error) => {
      console.log("catchcatch", error);
      logger.error({
        message: `Error while creating the assest :: =====>  ${JSON.stringify(error)}`,
      });
      callback(error);
    });
} 

const uploadAsset = (data, callback) => {
  console.log("uploadAsset : =====> ", JSON.stringify(data));
  var formdata = new FormData();
  formdata.append("file", fs.createReadStream(data.filePath), data.name);
  fetch(`${envVariables.CONTENT_SERVICE_URL}${API_URL.ASSET_UPLOAD}${data.identifier}`, {
      method: "POST", // or 'PUT'
      body: formdata,
    })
    .then((response) => response.json())
    .then((uploadResponseData) => {
      console.log("uploadResponseData ::: =====> ", JSON.stringify(uploadResponseData));
      if (uploadResponseData.responseCode && _.toLower(uploadResponseData.responseCode) === "ok") {
        data['artifactUrl'] = uploadResponseData.result.artifactUrl;
        callback(null, data);
      } else {
        callback(uploadResponseData);
      }
    }).catch((error) => {
      logger.error({
        message: `Error while uploading the assest ::  ${JSON.stringify(error)}`,
      });
      callback(error);
    });
} 

const deleteFileFromTemp = (data, callback) => {
  console.log("deleteFileFromTemp :: =====> ", data);
  fs.unlink(data.filePath, function(err) {
    if(err && err.code == 'ENOENT') {
        console.info("File doesn't exist, won't remove it. :: ", data.filePath);
    } else if (err) {
        // other errors, e.g. maybe we don't have enough permission
        console.error("Error occurred while trying to remove file :: ", data.filePath);
    } else {
        console.info("File deleted successfully :: ", data.filePath);
    }
  });
  return callback(null, data);
} 


// gets the part after /d/ and up until the next /, 
// which is how the document URLs always contain their IDs. If no match is found for this, 
// then we simply return the original param, which is assumed to be the ID.
const getIdFromUrl = (url) => {
  var parts = url.match(/\/d\/(.+)\//);
  if (parts == null || parts.length < 2) {
    return url;
  } else {
    return parts[1];
  }
}

const prepareQuestionBody = (question, createQuestionRes, callback) => {
  let metadata = {
    editorState: {},
    body: mergeQuestionTextAndImage(question.questionText, question.questionImage)
  };
  const questionType  = question.questionType.toLowerCase();
  if (questionType === 'mcq') {
    metadata = _.assign(metadata, prepareMcqBody(question));
  }

  metadata = _.assign(metadata, _.pick(question, ['additionalCategories', 'board', 'medium', 'gradeLevel', 
  'subject', 'topic', 'learningOutcome','skill','keywords','audience', 'author', 'copyright', 'license', 'attributions',
  'channel', 'framework', 'topic', 'createdBy', 'questionFileRefId', 'processId']));
  metadata.editorState.question = mergeQuestionTextAndImage(question.questionText, question.questionImage);
  metadata = _.omitBy(metadata, _.isEmpty);
  console.log("prepareQuestionBody :: => ", JSON.stringify(metadata));
  callback(null, metadata, createQuestionRes);
}

const mergeQuestionTextAndImage = (questionText, questionImage) => {
  const questionTemplate = '<figure class=\"image image-style-align-left resize-25\"><img src=\"{questionImage}\" alt=\"\"></figure><p><br>{questionText}</p>'
  if(!_.isEmpty(questionImage)) {
    return questionTemplate.replace('{questionImage}', questionImage)
    .replace('{questionText}', questionText);
  } else {
    return `<p>${questionText}</p>`
  }
}

const prepareMcqBody = (question) => {
  const correctAnswer = Number(question.answerNo);
  const templateId = templateClassMap[question.optionLayout];
  let options = [];
  let interactOptions = [];
 _.forEach(_.range(total_options), (opt, index) => {
    let optionValue = question[`option${index + 1}`];
    let optionImage = question[`option${index + 1}Image`];
    if (!_.isEmpty(optionValue) || !_.isEmpty(optionImage)) {
      options.push({ 
        answer: correctAnswer === (index + 1), 
        value: { body: mergeQuestionTextAndImage(optionValue, optionImage), value: index } 
      });
      interactOptions.push({ label:mergeQuestionTextAndImage(optionValue, optionImage), value: index });
    }
  });
  let metadata = {
    body: getMcqQuestionHtmlBody(question, templateId),
    templateId: templateId,
    name: question.name ? question.name :'Multiple Choice Question',
    responseDeclaration: getResponseDeclaration(question),
    interactionTypes: ['choice'],
    interactions: {
      response1: {
        type: 'choice',
        options: interactOptions
      }
    },
    editorState: {
      options
    },
    qType: _.toUpper(question.questionType),
    primaryCategory: 'Multiple Choice Question'
  };
  return metadata;
}

const getMcqQuestionHtmlBody = (question, templateId) => {
  const mcqBodyWithoutImage = '<div class=\'question-body\'><div class=\'mcq-title\'>{questionText}</div><div data-choice-interaction=\'response1\' class=\'{templateClass}\'></div></div>';
  const mcqBodyWithImage = "<div class='question-body'><div class='mcq-title'><figure class=\"image image-style-align-left resize-25\"><img src=\"{questionImage}\" alt=\"\" ></figure><p><br>{questionText}</p></div><div data-choice-interaction='response1'class=\'{templateClass}\'></div></div>";
  const mcqBody = question.questionImage ? mcqBodyWithImage : mcqBodyWithoutImage;
  const questionBody = mcqBody.replace('{templateClass}', templateId)
    .replace('{questionText}', question.questionText)
    .replace('{questionImage}', question.questionImage);
  return questionBody;
}

const getResponseDeclaration = (question) => {
  const responseDeclaration = {
    response1: {
      maxScore: 1,
      cardinality: 'single',
      type: 'integer',
      correctResponse: {
        value: question.answerNo,
        outcomes: { SCORE: 1 }
      }
    }
  };
  return responseDeclaration;
}

const updateQuestion = (questionBody, createQuestionRes, callback) => {
  const updateNewData = {
    request: {
      question: questionBody
    }
  };
  //fetch call for creating a question.
  console.log('updateQuestionBody:: =====> ' , JSON.stringify(updateNewData));
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_UPDATE}${createQuestionRes.result.identifier}`, {
      method: "PATCH", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(updateNewData),
    })
    .then((response) => response.json())
    .then((updateResponseData) => {
      if (updateResponseData.responseCode && _.toLower(updateResponseData.responseCode) === "ok") {
        callback(null, updateResponseData);
      } else {
        updateResponse(
          questionRes.result.identifier,
          `Something Went wrong while updating the questions: ${JSON.stringify(updateResponseData)}`
        );
        callback(updateResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while updating the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something Went wrong while updating the questions: ${JSON.stringify(error)}`
      );
      callback(error);
  });
}

const reviewQuestion = (status, questionRes, callback) => {

  if(status && _.toLower(status) === 'draft') {
    return callback(null, questionRes);
  }

  let reviewData = { request: { question: {} } };
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_REVIEW}${questionRes.result.identifier}`,
    {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(reviewData),
    }
  )
    .then((response) => response.json())
    .then((reviewResponseData) => {
      console.log("reviewQuestion response:: =====> ", JSON.stringify(reviewResponseData));
      if (reviewResponseData.responseCode && _.toLower(reviewResponseData.responseCode) === "ok") {
        callback(null, reviewResponseData);
      } else {
        updateResponse(
          questionRes.result.identifier,
          `Something Went wrong while reviewing the questions: ${JSON.stringify(reviewResponseData)}`
        );
        callback(reviewResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while reviewing the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something Went wrong while reviewing the questions: ${JSON.stringify(error)}`
      );
      callback(error);
    });
}

const publishQuestion = (status, questionRes, callback) => {
  if(status && _.includes(['draft', 'review'], _.toLower(status))) {
    return callback(null, questionRes);
  }
  let publishApiData = { request: { question: {} } };
  fetch(
    `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_PUBLISH}${questionRes.result.identifier}`,
    {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(publishApiData),
    })
    .then((response) => response.json())
    .then((publishResponseData) => {
      console.log("reviewQuestion response:: =====> ", JSON.stringify(publishResponseData));
      if (publishResponseData.responseCode && _.toLower(publishResponseData.responseCode) === "ok") {
        callback(null, publishResponseData);
      } else {
        updateResponse(
          questionRes.result.identifier,
          `Something went wrong while Publishing the question :: ${JSON.stringify(publishResponseData)}`
        );
        callback(publishResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while publishing the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something went wrong while Publishing the question :: ${JSON.stringify(error)}`
      );
      callback(error);
    });
}

const linkQuestionToQuestionSet = (questionData, questionRes, callback) => {
  if(!_.has(questionData, 'questionSetId') && _.isEmpty(questionData.questionSetSectionId)) {
    return callback(null, 'DONE');
  }
  let publishApiData = { 
    request: { 
      questionset: { 
        "rootId" : questionData.questionSetId, 
        ...(!_.isEmpty(questionData.questionSetSectionId) && { collectionId: questionData.questionSetSectionId}),
        "children": [questionRes.result.identifier] } }
  };
  console.log('linkQuestionToQuestionSet:: =====> ' , JSON.stringify(publishApiData));
  fetch(
    `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTIONSET_ADD}`,
    {
      method: "PATCH", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(publishApiData),
    })
    .then((response) => response.json())
    .then((linkResponseData) => {
      if (linkResponseData.responseCode && _.toLower(linkResponseData.responseCode) === "ok") {
        console.log('Successfully linkQuestionToQuestionSet:: =====> ' , JSON.stringify(linkResponseData));
        callback(null, linkResponseData);
      } else {
        logger.error({
          message: `Error while linking the question ::  ${JSON.stringify(error)}`,
        });
        updateResponse(
          questionRes.result.identifier,
          `Something went wrong while linking the question :: ${JSON.stringify(linkResponseData)}`
        );
        callback(linkResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while linking the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something went wrong while linking the question :: ${JSON.stringify(error)}`
      );
      callback(error);
    });
}

const retireQuestion = (identifier) => {
  const reqBody = {
    "request": {
      "question": {}
    }
  };
  console.log("retireQuestion :: request Body:: =====> ", JSON.stringify(reqBody));
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_RETIRE}${identifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(reqBody),
    })
    .then((response) => response.json())
    .then((response) => {
      rspObj.responseCode = "OK";
      rspObj.result = {
        questionStatus: `Successfully retire the question for the identifier: ${identifier}`,
      };
      logger.info({
        message: "Successfully retire the question",
        rspObj,
      });
    })
    .catch((error) => {
      rspObj.errMsg = `Something Went wrong while retiring question :: ${identifier} `;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      logger.error(
        {
          message: "Something Went wrong while retiring question",
          errorData: error,
          rspObj,
        },
        errorCodes.CODE2
      );
    });
};

//function to update the status of all other fetch calls mentioned above using question update.
const updateResponse = (identifier, updateMessage) => {
  const updateNewData = {
    request: {
      question: {
        questionUploadStatus: updateMessage,
      }
    }
  };
  console.log("updateResponse :: request Body:: =====> ", JSON.stringify(updateNewData));
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}${API_URL.QUESTION_UPDATE}${identifier}`, {
      method: "PATCH", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(updateNewData),
    })
    .then((response) => response.json())
    .then((updateResult) => {
      console.log("updateResult :: ======> ", JSON.stringify(updateResult));
      retireQuestion(identifier);
      rspObj.responseCode = "OK";
      rspObj.result = {
        questionStatus: `Successfully updated the question error data for the identifier: ${identifier}`,
      };
      logger.info({
        message: "Successfully updated the question error data",
        rspObj,
      });
    })
    .catch((error) => {
      retireQuestion(identifier);
      rspObj.errMsg = `Something Went wrong while updating question error data :: ${identifier}`;
      rspObj.responseCode = responseCode.SERVER_ERROR;
      logger.error(
        {
          message: "Something Went wrong while updating question error data",
          errorData: error,
          rspObj,
        },
        errorCodes.CODE2
      );
    });
};

module.exports = {
  qumlConsumer,
  updateResponse
};
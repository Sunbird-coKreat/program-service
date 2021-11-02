const fs = require("fs");
var kafka = require("kafka-node");
var FormData = require('form-data');
const fetch = require("node-fetch");
const logger = require("sb_logger_util_v2");
const { v4: uuidv4 } = require("uuid");
const loggerService = require("./loggerService");
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
const total_options = 4;
const rspObj = {};

const qumlConsumer = () => {
  try {
    Consumer = kafka.Consumer;
    ConsumerGroup = kafka.ConsumerGroup;
    client = new kafka.KafkaClient({
      kafkaHost: envVariables.SUNBIRD_KAFKA_HOST,
    });
    payload = [
      {
        topic: envVariables.SUNBIRD_QUESTION_BULKUPLOAD_TOPIC,
        partition: 1,
      },
    ];

    var options = {
      kafkaHost: envVariables.SUNBIRD_KAFKA_HOST,
      groupId: envVariables.SUNBIRD_KAFKA_BULKUPLOAD_CONSUMER_GROUP_ID,
      fromOffset: "latest",
    };
    var consumerGroup = new ConsumerGroup(options, [
      envVariables.SUNBIRD_QUESTION_BULKUPLOAD_TOPIC
    ]);
    consumerGroup.on("message", function (message) {
        logger.info({ message: "Entered into the consumer service" });
        let parsedJsonValue = JSON.parse(message.value);;
        console.log("Kafka consumer :: ", parsedJsonValue);
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

const initQuestionCreateProcess = (questionData) => {
  logger.info({ message: "Question creating process started" });
  async.waterfall([
    async.apply(startDownloadFileProcess, questionData),
    async.apply(prepareQuestionBody),
    async.apply(createQuestion),
    async.apply(reviewQuestion, questionData.status),
    async.apply(publishQuestion, questionData.status),
    async.apply(linkQuestionToQuestionSet, questionData)
  ], function (err, result) {
      if(err) { 
        return logger.error(
          {
            message: `Something Went Wrong While Creating the question ${JSON.stringify(error)}`,
          },
          err
        ); 
      }
      console.log('initQuestionCreateProcess :: SUCCESS ::', JSON.stringify(result));
  });
};

const startDownloadFileProcess = (question, outerCallback) => {
  const filesToDownload = _.omitBy(_.pick(question, ['questionImage','option1Image', 'option2Image', 'option3Image', 'option4Image']), _.isEmpty);
  if(_.isEmpty(filesToDownload)) {
    return outerCallback(null, question);
  }
  const downloadedFiles = {};
  async.eachOfSeries(filesToDownload, function (data, key, callback) {
    const fileId = getIdFromUrl(data);
    if(_.has(downloadedFiles,fileId)) {
      question[key] = _.get(downloadedFiles,fileId);
      console.log(key, " :: File already downloaded :: ", data)
      callback(null, 'File');
    } else {
      async.waterfall([
        async.apply(downloadFile, data),
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
    if (error) {
      outerCallback(error);
    } else {
      outerCallback(null, question);
    }
  });
}


const downloadFile = (data, callback) => {
  const googleAuth =  new GoogleOauth();
  const fileId = getIdFromUrl(data);
  googleAuth.downloadFile(fileId).then((result) => {
    console.log("RESULT ::", result);
    callback(null, result);
  }).catch((error) => {
    callback(error);
  })
}

const createAssest = (question, data, callback) => {
  const extension = path.extname(data.name);  
  const filename = path.basename(data.name, extension);
  const mediaType = _.first(_.split(data.mimeType, '/'));
  console.log("createAssest =====>", data);
  console.log("createAssest channel =====>", question.channel);
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
  console.log("createAssest request Body =====>", reqBody);
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/asset/v1/create`, {
      method: "POST", // or 'PUT'
      headers: {
        "X-Channel-ID": question.channel,
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(reqBody),
    })
    .then((response) => response.json())
    .then((assetResponseData) => {
      if (assetResponseData.responseCode && _.toLower(assetResponseData.responseCode) === "ok") {
        data['identifier'] = assetResponseData.result.identifier;
        callback(null, data);
      } else {
        callback(assetResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while creating the assest ::  ${JSON.stringify(error)}`,
      });
      callback(error);
    });
} 

const uploadAsset = (data, callback) => {
  console.log("uploadAsset : ==> ", data);
  var formdata = new FormData();
  formdata.append("file", fs.createReadStream(data.filePath), data.name);
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/asset/v1/upload/${data.identifier}`, {
      method: "POST", // or 'PUT'
      headers: {
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: formdata,
    })
    .then((response) => response.json())
    .then((uploadResponseData) => {
      console.log("uploadResponseData ::: ==> ", JSON.stringify(uploadResponseData));
      if (uploadResponseData.responseCode && _.toLower(uploadResponseData.responseCode) === "ok") {
        data['artifactUrl'] = uploadResponseData.result.artifactUrl;
        callback(null, data);
      } else {
        callback(uploadResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while uploading the assest ::  ${JSON.stringify(error)}`,
      });
      callback(error);
    });
} 

const deleteFileFromTemp = (data, callback) => {
  console.log("deleteFileFromTemp :: ===>", data);
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

const prepareQuestionBody = (question, callback) => {
  let metadata = {
    code : uuidv4(),
    mimeType: 'application/vnd.sunbird.question',
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
  console.log("prepareQuestionBody :: => ", metadata);
  callback(null, metadata);
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

const createQuestion = (questionBody, callback) => {
  let createApiData = {
    "request": {
        "question": questionBody
    }
  };
  //fetch call for creating a question.
  console.log('createQuestionBody::' , JSON.stringify(createApiData));
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/question/v1/create`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(createApiData),
    })
    .then((response) => response.json())
    .then((createResponseData) => {
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

const reviewQuestion = (status, questionRes, callback) => {

  if(status && _.toLower(status) === 'draft') {
    return callback(null, questionRes);
  }

  let reviewData = { request: { question: {} } };
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/question/v1/review/${questionRes.result.identifier}`,
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
      console.log("reviewQuestion response:: ", reviewResponseData);
      if (reviewResponseData.responseCode && _.toLower(reviewResponseData.responseCode) === "ok") {
        callback(null, reviewResponseData);
      } else {
        callback(reviewResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while reviewing the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something Went wrong while reviewing the questions: ${error}`
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
    `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/question/v1/publish/${questionRes.result.identifier}`,
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
      console.log("reviewQuestion response:: ", publishResponseData);
      if (publishResponseData.responseCode && _.toLower(publishResponseData.responseCode) === "ok") {
        callback(null, publishResponseData);
      } else {
        callback(publishResponseData);
      }
    })
    .catch((error) => {
      logger.error({
        message: `Error while publishing the question ::  ${JSON.stringify(error)}`,
      });
      updateResponse(
        questionRes.result.identifier,
        `Something went wrong while Publishing the question`
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
  fetch(
    `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/questionset/v1/add`,
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
        // updateResponse(
        //   questionRes.result.identifier,
        //   `Successfully linked the question for the identifier:${questionRes.result.identifier}`
        // );
        callback(null, linkResponseData);
      } else {
        logger.error({
          message: `Error while linking the question ::  ${JSON.stringify(error)}`,
        });
        updateResponse(
          questionRes.result.identifier,
          `Something went wrong while linking the question`
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
        `Something went wrong while linking the question`
      );
      callback(error);
    });
}


//function to update the status of all other fetch calls mentioned above using question update.
const updateResponse = (updateData, updateMessage) => {
  const updateNewData = {
    request: {
      question: {
        questionUploadStatus: updateMessage,
      }
    }
  };
  console.log("updateResponse :: request Body::", updateNewData);
  fetch(`${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/question/v1/update/${updateData}`, {
      method: "PATCH", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "Authorization" : `Bearer ${envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN}`
      },
      body: JSON.stringify(updateNewData),
    })
    .then((response) => response.json())
    .then((updateResult) => {
      console.log("updateResult :: ======> ", updateResult);
      rspObj.responseCode = "OK";
      rspObj.result = {
        questionStatus: `Successfully updated the question data for the identifier: ${updateData}`,
      };
      logger.info({
        message: "Successfully updated the question data",
        rspObj,
      });
    })
    .catch((error) => {
      rspObj.errMsg = "Something Went wrong while updating question data";
      rspObj.responseCode = responseCode.SERVER_ERROR;
      logger.error(
        {
          message: "Something Went wrong while updating question data",
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

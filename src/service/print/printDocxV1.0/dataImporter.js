const { async } = require("rxjs/internal/scheduler/async");
const fetch = require("node-fetch");
const axios = require("axios");

const envVariables = require("../../../envVariables");
const { result } = require("lodash");

class PrintDocx1ImportError {
  constructor(message) {
    this.message = message;
    this.name = "PrintDocx1ImportError";
  }
}
const fields =
  "body,primaryCategory,mimeType,qType,answer,templateId,responseDeclaration,interactionTypes,interactions,name,solutions,editorState,media,name,board,medium,gradeLevel,subject,topic,learningOutcome,maxScore,bloomsLevel,author,copyright,license";

const QUE_READ_URL= `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/question/v4/read/`;
const QS_HIERARCHY_READ_URL = `${envVariables.SUNBIRD_ASSESSMENT_SERVICE_BASE_URL}/questionset/v4/hierarchy/`;


const getQuestionForSet = async (id) => {
  let url= `${QUE_READ_URL}${id}?fields=${fields}`
   const request = {
    url: url,
    method: "get",
  };

  return axios(request).then((r) => {
    return r.data.result.question;
  }).catch((e)=>{
    return{
      error:true,
      errormsg:"wrong ID"
    }
  })
};
const getQuestionSet = async (id) => {
  const headers = {
    Authorization: "Bearer " + envVariables.SUNBIRD_PORTAL_API_AUTH_TOKEN
  };
  let url= `${QS_HIERARCHY_READ_URL}${id}?mode=edit`
  const request = {
    url: url,
    method: "get",
    headers,
  };

  return axios(request).then((r) => {
    const data = r.data.result.questionSet;

    let sections;
    if (data && "children" in data) sections = data.children;
    else {
      throw new PrintDocx1ImportError("Invalid ID");
    }
    const questionIds = sections.map((section) => {
      if (section.children)
        return section.children
          .filter(
            (child) =>
              data.acceptedContributions &&
              data.acceptedContributions.indexOf(child.identifier) > -1
          )
          .map((child) => {
            return child.identifier;
          });
      else return [];
    }); // Hierarchy

    const promiseMap = questionIds.map((sec) =>
      sec.map((question) => {
        if (question !== undefined) {
          return getQuestionForSet(question).then((resp) => {
            return resp;
          });
        }
      })
    );

    const questionPromises = promiseMap.map((sectionPromise, index) =>
      Promise.all(sectionPromise)
        .then((result) => result)
        .catch((e) => {
          throw e;
        })
    );

    return Promise.all(questionPromises).then((results) => {
      const sectionData = results.map((questions, index) => {
        return {
          section: sections[index],
          questions: questions,
        };
      });

      return {
        sectionData,
        paperData: data,
      };
    });
  });
};

module.exports = {
  getQuestionSet,
};

const { async } = require("rxjs/internal/scheduler/async");
const fetch = require("node-fetch");
const axios = require("axios");

const envVariables = require("../../../envVariables");
const { result } = require("lodash");

class DocxDataImportError {
  constructor(message) {
    this.message = message;
    this.name = "DocxDataImportError";
  }
}
const fields =
  "body,primaryCategory,mimeType,qType,answer,templateId,responseDeclaration,interactionTypes,interactions,name,solutions,editorState,media,name,board,medium,gradeLevel,subject,topic,learningOutcome,maxScore,bloomsLevel,author,copyright,license";

const getQuestionForSet = async (id) => {
  const request = {
    url: `${envVariables.baseURL}/api/question/v1/read/${id}?fields=${fields}`,
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
    Authorization: "Bearer " + envVariables.TOKEN,
    rootOrgId: envVariables.ROOTID,
  };
  const request = {
    url: `${envVariables.baseURL}/api/questionset/v1/hierarchy/${id}?mode=edit`, //1.0
    method: "get",
    headers,
  };

  return axios(request).then((r) => {
    const data = r.data.result.questionSet;

    let sections;
    if (data && "children" in data) sections = data.children;
    else {
      throw new DocxDataImportError("Invalid ID");
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

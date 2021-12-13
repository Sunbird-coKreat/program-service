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
const fields = "body,primaryCategory,mimeType,qType,answer,templateId,responseDeclaration,interactionTypes,interactions,name,solutions,editorState,media,name,board,medium,gradeLevel,subject,topic,learningOutcome,marks,bloomsLevel,author,copyright,license"
const getQuestionForSet = async (id) => {
  const request = {
    url : `${envVariables.baseURL}/api/question/v1/read/${id}?fields=${fields}`,
    method: "get",
  };

  return axios(request).then(r => {
    return r.data.result.question
    // console.log("Data:",r.data.result)
  })

}
const getQuestionSet = async (id) => {
  console.log("Entered Que",id)
    const headers = {
      Authorization: "Bearer "+envVariables.TOKEN,
      rootOrgId: envVariables.ROOTID,
    };
    const request = {
      url : `${envVariables.baseURL}/api/questionset/v1/hierarchy/${id}?mode=edit`,
      method: "get",
      headers
    };
  
    return axios(request)
    .then((r) => {
      const data = r.data.result.questionSet;
      let sections;
      if (data && "children" in data) sections = data.children;
      else {
        throw new DocxDataImportError("Invalid ID");
      }
      // console.log("Sections:",sections)
      const questionIds = sections.map((section) => {
        if (section.children)
          return section.children
            .filter(
              (child) =>
                data.acceptedContributions &&
                data.acceptedContributions.indexOf(child.identifier) > -1
              
            )
            .map((child) => {
              if(child.identifier !== "do_1134277526348677121194"){
                return child.identifier
              }
              });
        else return [];
      }); // Hierarchy
      console.log("Question Ids:", questionIds);

      const promiseMap = questionIds.map((sec) =>
      sec.map((question) =>{
      if(question !== undefined){
      return getQuestionForSet(question).then((resp) => {
         return resp;
        })
      }
    }
      )
     
    );

    const questionPromises = promiseMap.map((sectionPromise, index) =>
        Promise.all(sectionPromise)
          .then((result) => result)
          .catch((e) => {
            throw e;
          })
      );
      console.log("questionPromises",questionPromises)

      return Promise.all(questionPromises).then((results) => {
        const sectionData = results.map((questions, index) => {
          return {
            section: sections[index],
            questions: questions,
          };
        });
        
        return {
          sectionData,
          paperData: data
        };
      });
    });
  };

  module.exports = {
    getQuestionSet,
  };
  //  getQuestionSet("do_1134116427537367041363");
  // console.log("Final result:",getQuestionSet("do_1134116427537367041363"))
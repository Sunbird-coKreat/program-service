const fetch = require("node-fetch");
const envVariables = require("../../envVariables");

const getQuestionForSection = async (id) => {
  const url = `${envVariables.baseURL}/action/content/v3/hierarchy/${id}?mode=edit`;
  return fetch(url)
    .then((r1) => r1.json())
    .then((r) => {
      const itemset = r.result.content.itemSets[0];
      const urlItemset = `${envVariables.baseURL}/action/itemset/v3/read/${itemset.identifier}`;
      return fetch(urlItemset)
        .then((r2) => r2.json())
        .then((r) => {
          const item = r.result.itemset.items[0];
          const urlItem = `${envVariables.baseURL}/action/assessment/v3/items/read/${item.identifier}`;
          console.log(urlItem);
          return fetch(urlItem)
            .then((r3) => r3.json())
            .then((r) => {
              const question = r.result.assessment_item;
              return question;
            });
        });
    });
};

const getData = async (id) => {
  const url = `${envVariables.baseURL}/action/content/v3/hierarchy/${id}?mode=edit`;
  return fetch(url)
    .then((r4) => r4.json())
    .then((r) => {
      const data = r.result.content;
      const sections = data.children;

      const questionIds = sections.map((section) => {
        if (section.children)
          return section.children.map((child) => child.identifier);
        else return [];
      }); // Hierarchy

      const promiseMap = questionIds.map((sec) =>
        sec.map((question) => getQuestionForSection(question))
      );

      const questionPromises = promiseMap.map((sectionPromise, index) =>
        Promise.all(sectionPromise).then((result) => result)
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
  getData,
};

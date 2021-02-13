const fetch = require("node-fetch");

const getQuestionForSection = async (id) => {
  const url = `https://dock.sunbirded.org/action/content/v3/hierarchy/${id}?mode=edit`;
  return fetch(url)
    .then((r) => r.json())
    .then((r) => {
      //console.log(r);
      const itemset = r.result.content.itemSets[0];
      const urlItemset = `https://dock.sunbirded.org/action/itemset/v3/read/${itemset.identifier}`;
      return fetch(urlItemset)
        .then((r) => r.json())
        .then((r) => {
          const item = r.result.itemset.items[0];
          const urlItem = `https://dock.sunbirded.org/action/assessment/v3/items/read/${item.identifier}`;
          console.log(urlItem);
          return fetch(urlItem)
            .then((r) => r.json())
            .then((r) => {
              const question = r.result.assessment_item;
              return question;
            });
        });
    });
};

const getData = async (id) => {
  const url = `https://dock.sunbirded.org/action/content/v3/hierarchy/${id}?mode=edit`;
  return fetch(url)
    .then((r) => r.json())
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

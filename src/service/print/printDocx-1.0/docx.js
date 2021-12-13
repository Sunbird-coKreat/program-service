const { getQuestionSet } = require("./dataImporter");
const docx = require("docx");
const { Packer } = docx;
const getDocx = require("./getdocxdata");
const fs = require("fs");

var {
  docDefinition,
  getSectionTitle,
  getTF,
  getMTFHeader,
} = require("../utils/docDefinition");
const ProgramServiceHelper = require("../../../helpers/programHelper");
var cheerio = require("cheerio");
var cheerioTableparser = require("cheerio-tableparser");
const sizeOf = require("image-size");

const programServiceHelper = new ProgramServiceHelper();

const { size, create, compact, result } = require("lodash");
const { async } = require("rxjs/internal/scheduler/async");
const { body } = require("express-validator");

const buildDOCX_1_WithCallback = async (id, callback) => {
  let error = false;
  let errorMsg = "";
  let totalMarks = 0;
  getQuestionSet(id)
    .then(async (data) => {
      if (data.error) {
        callback(null, data.error, data.errorMsg);
      } else {
        let subject, grade, examName, instructions, language, description;
        if (data.paperData) {
          subject = data.paperData.subject && data.paperData.subject[0];
          grade = data.paperData.gradeLevel && data.paperData.gradeLevel[0];
          examName = data.paperData.name;
          instructions = data.paperData.description;
          language = data.paperData.medium && data.paperData.medium[0];
        }

        const questionPaperContent = [];
        const paperDetails = {
          examName: examName,
          className: grade,
          subject: subject,
          instructions: instructions.split(/\n/),
        };
        let questionCounter = 0;

        for (const d of data.sectionData) {
          const sectionTitle = getSectionTitle(
            d.section.name,
            detectLanguage(d.section.name)
          );
          const section = d.section.name;
          let questionContent;
          questionContent = [{ sectionHeader: section, type: "section" }];
          questionPaperContent.push(questionContent);

          for (const [index, question] of d.questions.entries()) {
            //later remove this if condition
            if(question !== undefined){

            questionCounter += 1;

            switch (question.qType) {
              case "MCQ":
                questionContent = [
                  await renderMCQ(question, questionCounter,1)
                ];
                break;
              case "FTB":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "FTB"
                  ),
                ];
                break;
              case "SA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "SA"
                  ),
                ];
                break;
              case "LA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "LA"
                  ),
                ];
                break;
              case "VSA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "VSA"
                  ),
                ];
                break;
              case "MTF":
                questionContent = await renderMTF(
                  question,
                  questionCounter,
                  question.marks,
                  "MTF"
                );
                break;
              case "COMPREHENSION":
                questionContent = [
                  await renderComprehension(
                    question,
                    questionCounter,
                    question.marks,
                    "COMPREHENSION"
                  ),
                ];
                break;
              case "CuriosityQuestion":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "CuriosityQuestion"
                  ),
                ];
                break;
            }
          }
            questionPaperContent.push(questionContent);
          }
        }
        const doc = await getDocx.create(questionPaperContent, paperDetails);

        const b64string = await Packer.toBase64String(doc);
        let filename = grade + "_" + subject + "_" + examName;
        filename = filename.replace(/\s/g, "");
        callback(b64string, null, null, filename);
      }
    })
    .catch((e) => {
      console.log(e);
      error = true;
      errorMsg = "";
      callback(null, error, errorMsg);
    });
};

const cleanHTML = (str, nbspAsLineBreak = false) => {
  // Remove HTML characters since we are not converting HTML to Docx.
  if (str === undefined) return ""
  else
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, nbspAsLineBreak ? "\n" : "");
};

const detectLanguage = (str) => {
  const unicodeBlocks = [
    {
      name: "Tamil",
      regex: /[\u0B80-\u0BFF]+/g,
    },
    {
      name: "Hindi",
      regex: /[\u0900-\u097F]+/g,
    },
  ];

  let language = "English";

  const langSplit = {
    Hindi: 0,
    Tamil: 0,
    English: 0,
    Undefined: 0,
  };
  if (typeof str === "string") {
    str.split("").forEach((letter) => {
      let found = false;
      unicodeBlocks.forEach((block) => {
        if (letter.match(block.regex)) {
          langSplit[block.name]++;
          found = true;
        }
      });
      if (!found) {
        langSplit.English++;
      }
    });

    let max = 0;
    for (var key of Object.keys(langSplit)) {
      if (langSplit[key] > max) {
        max = langSplit[key];
        language = key;
      }
    }

    return language;
  }
  return "English";
};

function createImageElement(src, width) {
  let imageElement = {};
  if (src.search("image/gif") >= 0) return null;
  imageElement.image = src;
  let img = Buffer.from(src.split(";base64,").pop(), "base64");
  let dimensions = sizeOf(img);
  let resizedWidth = dimensions.width * width;
  imageElement.width = resizedWidth > 200 ? 200 : resizedWidth;
  imageElement.height =
    (dimensions.height / dimensions.width) * imageElement.width;
  return imageElement;
}

function extractTextFromElement(elem) {
  let rollUp = "";
  if (cheerio.text(elem)) return cheerio.text(elem);
  // if ()
  else if (elem.name === "sup")
    return { text: elem.children[0].data, superScript: true };
  else if (elem.name === "sub")
    return { text: elem.children[0].data, subScript: true };
  else if (elem.name === "strong") {
    if (elem.children[0].data === undefined) {
      return getStyleEle(elem);
    } else {
      return { text: elem.children[0].data, bold: true };
    }
  } else if (elem.name === "i") {
    if (elem.children[0].data === undefined) {
      return getStyleEle(elem);
    } else {
      return { text: elem.children[0].data, italics: true };
    }
  } else if (elem.name === "br") return { br: "break" };
  else if (elem.name === "u") {
    if (elem.children[0].data === undefined) {
      return getStyleEle(elem);
    } else {
      return { text: elem.children[0].data, underline: true };
    }
  } else if (elem.type === "text" && elem.data) return elem.data;
  else {
    if (elem.children && elem.children.length) {
      for (const nestedElem of elem.children) {
        let recurse = extractTextFromElement(nestedElem);
        if (Array.isArray(rollUp)) {
          rollUp.push(recurse);
        } else {
          if (Array.isArray(recurse)) {
            rollUp = recurse;
          } else if (typeof recurse === "object") {
            rollUp = [rollUp, recurse];
          } else rollUp += recurse;
        }
      }
    }
  }
  return rollUp;
}

function getStyleEle(el) {
  let value = "";
  if (
    el.children[0].name &&
    (el.children[0].name === "i" ||
      el.children[0].name === "strong" ||
      el.children[0].name === "u")
  ) {
    return getStyleEle(el.children[0]);
  } else {
    if (el.children[0].data !== undefined) {
      {
        return (
          el.children[0] &&
          (el.children[0].data ||
            (el.children[0].children[0] && el.children[0].children[0].data))
        );
      }
    }
  }
}
async function getStack(htmlString, questionCounter) {
  const stack = [];
  $ = cheerio.load(htmlString);
  const elems = $("body").children().toArray();
  for (const [index, elem] of elems.entries()) {
    let nextLine = "";
    switch (elem.name) {
      case "p":
        let extractedText = extractTextFromElement(elem);
        // Returns array if superscript/subscript inside
        if (Array.isArray(extractedText)) nextLine = { text: extractedText };
        else nextLine += extractedText;
        break;
      case "ol":
        nextLine = {
          ol: elem.children.map((el) => {
            return getStyleEle(el);
          }),
        };
        break;

      case "ul":
        nextLine = {
          ul: elem.children.map((el) => {
            return getStyleEle(el);
          }),
        };
        break;
      case "figure":
        let { style } = elem.attribs;
        let width = 1;
        if (style) {
          width = parseFloat(style.split(":").pop().slice(0, -2));
          width = width / 100;
        }
        if (elem.children && elem.children.length) {
          let { src } = elem.children[0].attribs;
          if (src) {
            switch (src.slice(0, 4)) {
              case "data":
                nextLine = createImageElement(src, width);
                break;
              default:
                let res = await programServiceHelper.getQuestionMedia(src);
                nextLine = createImageElement(res, width);
            }
          }
        }
        if (!nextLine)
          nextLine = "<An image of an unsupported format was scrubbed>";
        break;
    }
    stack.push(nextLine);
  }
  return stack;
}

async function renderMCQ(question, questionCounter, marks) {
  const questionOptions = [],
    answerOptions = ["A", "B", "C", "D"];
  let questionTitle;
  for (const [index, qo] of question.editorState.options.entries()) {
    let qoBody = qo.value.body;
    let qoData =
      qoBody.search("img") >= 0 ||
      qoBody.search("sup") >= 0 ||
      qoBody.search("sub") >= 0 ||
      (qoBody.match(/<p>/g) && qoBody.match(/<p>/g).length >= 1) ||
      (qoBody.match(/<ol>/g) && qoBody.match(/<ol>/g).length >= 1)
        ? await getStack(qoBody, answerOptions[index])
        : [`${answerOptions[index]}. ${cleanHTML(qoBody)}`];
    questionOptions.push(qoData);
  }
  let q = question.editorState.question;
 
  questionTitle =
    q.search("img") >= 0 ||
    q.search("sub") >= 0 ||
    q.search("sup") >= 0 ||
    (q.match(/<p>/g) && q.match(/<p>/g).length >= 1) ||
    (q.match(/<ol>/g) && q.match(/<ol>/g).length >= 1)
      ? await getStack(q, questionCounter)
      : [`${questionCounter}. ${cleanHTML(q)}`];

  let questionOpt = [];
  let imageProperties = []; 
 
  if (questionOptions[0][1] !== undefined &&typeof questionOptions[0][1] === "object") {
    questionOpt.push("1."+questionOptions[0][0] + questionOptions[0][1].image);
    imageProperties.push({
      width: questionOptions[0][1].width,
      height: questionOptions[0][1].height,
    });
  } else {
    questionOpt.push("1."+questionOptions[0][0]);
    imageProperties.push({
      width: 0,
      height: 0,
    });
  }

  if (questionOptions[1][1] !== undefined && typeof questionOptions[1][1] === "object") {
    questionOpt.push("2."+questionOptions[1][0] + questionOptions[1][1].image);
    imageProperties.push({
      width: questionOptions[1][1].width,
      height: questionOptions[1][1].height,
    });
  } else {
    questionOpt.push("2."+questionOptions[1][0]);
    imageProperties.push({
      width: 0,
      height: 0,
    });
  }

  if (questionOptions[2] !== undefined && typeof questionOptions[2][1] === "object") {
    questionOpt.push("3."+questionOptions[2][0] + questionOptions[2][1].image);
    imageProperties.push({
      width: questionOptions[2][1].width,
      height: questionOptions[2][1].height,
    });
  } else {
    questionOpt.push("3."+questionOptions[2][0]);
    imageProperties.push({
      width: 0,
      height: 0,
    });
  }

  if (questionOptions[3][1] !== undefined && typeof questionOptions[3][1] === "object") {
    questionOpt.push("4."+questionOptions[3][0] + questionOptions[3][1].image);
    imageProperties.push({
      width: questionOptions[3][1].width,
      height: questionOptions[3][1].height,
    });
  } else {
    questionOpt.push("4."+questionOptions[3][0]);
    imageProperties.push({
      width: 0,
      height: 0,
    });
  }

  let data = {
    QuestionIndex: questionCounter,
    Questions: questionTitle,
    Option1: questionOpt[0],
    Option2: questionOpt[1],
    Option3: questionOpt[2],
    Option4: questionOpt[3],
    // Marks: marks,
    Language: detectLanguage(questionTitle[0]),
    type: "MCQ",
    height1: imageProperties[0].height,
    width1: imageProperties[0].width,
    height2: imageProperties[1].height,
    width2: imageProperties[1].width,
    height3: imageProperties[2].height,
    width3: imageProperties[2].width,
    height4: imageProperties[3].height,
    width4: imageProperties[3].width,
  };
  return data;
}

async function renderQuestion(question, questionCounter, marks, Type) {
  let data;
  if (
    (question.media && question.media.length) ||
    question.editorState.question.search("img") >= 0 ||
    question.editorState.question.search("sub") >= 0 ||
    question.editorState.question.search("sup") >= 0 ||
    question.editorState.question.search("ul") >= 0 ||
    (question.editorState.question.match(/<p>/g) &&
      question.editorState.question.match(/<p>/g).length >= 1) ||
    (question.editorState.question.match(/<ol>/g) &&
      question.editorState.question.match(/<ol>/g).length >= 1)
  ) {
    data = await getStack(question.editorState.question, questionCounter);
  } else {
    data = [`${questionCounter}. ${cleanHTML(question.editorState.question)}`];
  }
  let quedata = {
    QuestionIndex: questionCounter,
    Questions: data,
    Marks: marks,
    type: Type,
  };
  return quedata;
}

async function renderComprehension(question, questionCounter, marks, Type) {
  let data;
  if (
    (question.media && question.media.length) ||
    question.editorState.question.search("img") >= 0 ||
    question.editorState.question.search("sub") >= 0 ||
    question.editorState.question.search("sup") >= 0 ||
    question.editorState.question.search("ol") >= 0 ||
    question.editorState.question.search("ul") >= 0 ||
    (question.editorState.question.match(/<p>/g) &&
      question.editorState.question.match(/<p>/g).length >= 1) ||
    (question.editorState.question.match(/<ol>/g) &&
      question.editorState.question.match(/<ol>/g).length >= 1)
  ) {
    data = await getStack(question.editorState.question, questionCounter);
  } else {
    data = [`${questionCounter}. ${cleanHTML(question.editorState.question)}`];
  }
  let quedata = {
    QuestionIndex: questionCounter,
    Questions: data,
    Marks: marks,
    type: Type,
  };
  return quedata;
}

async function renderMTF(question, questionCounter, marks, Type) {
  $ = cheerio.load(question.editorState.question);
  
  cheerioTableparser($);
  var data = [];
  var columns = $("table").parsetable(false, false, false);
  let transposeColumns = columns[0].map((_, colIndex) =>
    columns.map((row) => row[colIndex])
  );

  const heading =   cleanHTML($("p").first().text());
  data.push(heading, detectLanguage(heading), marks);
  data.push(
    getMTFHeader(
      cleanHTML(transposeColumns[0][0]),
      cleanHTML(transposeColumns[0][1]),
      detectLanguage(cleanHTML(transposeColumns[0][0]))
    )
  );

  transposeColumns.shift();

  const rows = [];
  for (const r of transposeColumns) {
    let left, right;
    if (r[0].search("img") >= 0) {
      left = await getStack(r[0]);
    } else left = [cleanHTML(r[0])];
    if (r[1].search("img") >= 0) {
      right = await getStack(r[1]);
    } else right = [cleanHTML(r[1])];
    rows.push({ left, right });
  }

  let mtfData = [
    {
      QuestionIndex: questionCounter,
      Questions: rows,
      Marks: marks,
      type: Type,
      heading: heading,
    },
  ];
  return mtfData;
}
module.exports = {
  buildDOCX_1_WithCallback,
};

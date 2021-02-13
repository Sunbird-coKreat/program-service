var PdfPrinter = require("pdfmake");
const { getData } = require("./dataImporter");

var {
  docDefinition,
  getStudentTeacherDetails,
  getExamName,
  getGradeHeader,
  getSubject,
  getTimeAndMarks,
  getInstructions,
  getMCQ,
  getFTB,
  getSectionTitle,
  getTF,
  getSA,
  getVSA,
  getLA,
} = require("./utils/docDefinition");

var fonts = {
  Roboto: {
    normal: "utils/fonts/Roboto/Roboto-Regular.ttf",
    bold: "utils/fonts/Roboto/Roboto-Medium.ttf",
    italics: "utils/fonts/Roboto/Roboto-Italic.ttf",
    bolditalics: "utils/fonts/Roboto/Roboto-MediumItalic.ttf",
  },
  Hindi: {
    normal: "utils/fonts/Hindi/Jaldi-Regular.ttf",
    bold: "utils/fonts/Hindi/Jaldi-Bold.ttf",
    italics: "utils/fonts/Hindi/Jaldi-Regular.ttf",
    bolditalics: "utils/fonts/Hindi/Jaldi-Bold.ttf",
  },
  Noto: {
    normal: "utils/fonts/Noto/NotoSans-Regular.ttf",
    bold: "utils/fonts/Noto/NotoSans-SemiBold.ttf",
    italics: "utils/fonts/Noto/NotoSans-Italic.ttf",
    bolditalics: "utils/fonts/Noto/NotoSans-SemiBoldItalic.ttf",
  },
  English: {
    normal: "utils/fonts/Noto/NotoSans-Regular.ttf",
    bold: "utils/fonts/Noto/NotoSans-SemiBold.ttf",
    italics: "utils/fonts/Noto/NotoSans-Italic.ttf",
    bolditalics: "utils/fonts/Noto/NotoSans-SemiBoldItalic.ttf",
  },
};

var printer = new PdfPrinter(fonts);
var fs = require("fs");
const { language } = require("googleapis/build/src/apis/language");

const file_header = ";headers=filename%3D";

var options = {
  // ...
};

const buildPDF = async (id) => {
  return getData(id).then((s) => {
    var doc = printer.createPdfKitDocument(docDefinition, options);
    doc.pipe(fs.createWriteStream(`${id}.pdf`));
    doc.end();
    return `${id}.pdf`;
  });
};

const buildPDFWithCallback = (id, callback) => {
  getData(id).then((data) => {
    const subject = data.paperData.subject[0];
    const grade = data.paperData.gradeLevel[0];
    const examName = data.paperData.name;
    const instructions = data.paperData.description;
    let language = data.paperData.medium[0];

    // const language = "Noto";

    const contentBase = [
      getStudentTeacherDetails(),
      getExamName(examName),
      getGradeHeader(grade),
      getSubject(subject),
      getTimeAndMarks(),
      getInstructions(instructions, language),
    ];

    const questionPaperContent = [];
    let questionCounter = 0;

    data.sectionData.forEach((d) => {
      const sectionTitle = getSectionTitle(
        d.section.name,
        detectLanguage(d.section.name)
      );
      questionPaperContent.push(sectionTitle);
      const section = d.section;

      d.questions
        .filter((question) => question.status === "Live")
        .map((question, index) => {
          // Check question type and proceed based on that.
          questionCounter += 1;
          const marks = section.children[index].marks;
          let questionContent;
          try {
            if (question.category === "MCQ")
              questionContent = renderMCQ(question, questionCounter, marks);
            else if (question.category === "FTB") {
              questionContent = renderFTB(question, questionCounter, marks);
            } else if (question.category === "SA") {
              questionContent = renderSA(question, questionCounter, marks);
            } else if (question.category === "LA") {
              questionContent = renderLA(question, questionCounter, marks);
            } else if (question.category === "VSA") {
              questionContent = renderVSA(question, questionCounter, marks);
            } else if (question.category === "TF") {
              questionContent = renderTF(question, questionCounter, marks);
            }

            questionPaperContent.push(questionContent);
          } catch (e) {
            console.log(question);
            console.log(e);
          }
        });
    });

    docDefinition.content = contentBase.concat(questionPaperContent);

    var doc = printer.createPdfKitDocument(docDefinition, options);
    var chunks = [];
    var result;
    doc.on("data", function (chunk) {
      chunks.push(chunk);
    });
    doc.on("end", function () {
      result = Buffer.concat(chunks);
      callback(`data:application/pdf;base64,` + result.toString("base64"));
    });
    doc.end();
  });
};

const cleanHTML = (str) => {
  // Remove HTML characters since we are not converting HTML to PDF.
  return str.replace(/<[^>]+>/g, "").replace("&nbsp;", "");
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

  console.log(str, langSplit);

  return language;
};

function renderMCQ(question, questionCounter, marks) {
  const questionOptions = question.editorState.options.map((qo) =>
    cleanHTML(qo.value.body)
  );
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getMCQ(
    questionTitle,
    questionOptions,
    detectLanguage(questionTitle[0]),
    marks
  );
}

function renderFTB(question, questionCounter, marks) {
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getFTB(questionTitle, detectLanguage(questionTitle[0]), marks);
}

function renderSA(question, questionCounter, marks) {
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getSA(questionTitle, detectLanguage(questionTitle[0]), marks);
}

function renderLA(question, questionCounter, marks) {
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getLA(questionTitle, detectLanguage(questionTitle[0]), mark);
}

function renderVSA(question, questionCounter, marks) {
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getVSA(questionTitle, detectLanguage(questionTitle[0]), marks);
}

function renderTF(question, questionCounter, marks) {
  const questionTitle =
    questionCounter + ". " + cleanHTML(question.editorState.question);
  return getTF(questionTitle, detectLanguage(questionTitle[0]), marks);
}

module.exports = {
  buildPDF,
  buildPDFWithCallback,
};

/* =========================================================
   EXAM OMR V2
   Main JavaScript
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
  "https://veanswqdgwffiespeokc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IuXKh35oKJiu3_a3HKurkw_YSURgtdT";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   PDF.JS
   ========================================================= */

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_BUCKET =
  "question-papers";

const OPTION_LABELS =
  ["A", "B", "C", "D"];

const MAX_QUESTIONS =
  300;


/* =========================================================
   STATE
   ========================================================= */

let currentTest = null;

let currentPdfUrl = "";

let currentQuestionCount = 40;

let currentOptions = [];

let currentAnswerKey = [];

let selectedAnswers = [];

let testCreatedCode = "";

let currentStudent = {
  name: "",
  roll: "",
  section: ""
};

let currentResult = null;

let examTimerInterval = null;

let examSecondsRemaining = 0;


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


function show(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}


function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
}


function setLoading(
  showLoading,
  text = "Please wait..."
) {
  const overlay =
    $("loadingOverlay");

  const loadingText =
    $("loadingText");

  if (loadingText) {
    loadingText.textContent =
      text;
  }

  if (showLoading) {
    show(overlay);
  } else {
    hide(overlay);
  }
}


function showStatus(
  element,
  message,
  type = ""
) {
  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    "status-box";

  if (type) {
    element.classList.add(type);
  }

  show(element);
}


function hideStatus(element) {
  if (!element) {
    return;
  }

  hide(element);
}


function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => {
      hide(screen);
    });

  const target =
    $(screenId);

  if (target) {
    show(target);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   TEST CODE
   ========================================================= */

function generateTestCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {

    const randomIndex =
      Math.floor(
        Math.random() *
        characters.length
      );

    code +=
      characters[randomIndex];
  }

  return code;
}


async function generateUniqueTestCode() {

  for (
    let attempt = 0;
    attempt < 10;
    attempt++
  ) {

    const code =
      generateTestCode();

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select("id")
        .eq("code", code)
        .limit(1);

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {
      return code;
    }
  }

  throw new Error(
    "Could not generate a unique test code."
  );
}


/* =========================================================
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(
  optionCount
) {
  return OPTION_LABELS.slice(
    0,
    optionCount
  );
}


function normalizeOptionCount(
  value
) {
  const number =
    Number(value);

  return number === 2
    ? 2
    : 4;
}


/* =========================================================
   CREATE TEST
   ========================================================= */

function renderOptionSettings() {

  const container =
    $("optionSettings");

  if (!container) {
    return;
  }

  const count =
    Math.max(
      1,
      Math.min(
        MAX_QUESTIONS,
        Number(
          $("questionCount").value
        ) || 40
      )
    );

  const defaultOptionCount =
    normalizeOptionCount(
      $("defaultOptions").value
    );

  currentQuestionCount =
    count;

  container.innerHTML = "";

  for (
    let i = 1;
    i <= count;
    i++
  ) {

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "option-setting";

    const number =
      document.createElement(
        "div"
      );

    number.className =
      "option-setting-number";

    number.textContent =
      i;

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "question-option-count";

    select.dataset.question =
      String(i);

    select.innerHTML = `
      <option value="4">
        4 Options
      </option>

      <option value="2">
        2 Options
      </option>
    `;

    select.value =
      String(
        defaultOptionCount
      );

    wrapper.appendChild(
      number
    );

    wrapper.appendChild(
      select
    );

    container.appendChild(
      wrapper
    );
  }
}


function collectQuestionOptions() {

  const selects =
    document.querySelectorAll(
      ".question-option-count"
    );

  return Array
    .from(selects)
    .map(
      (select) =>
        normalizeOptionCount(
          select.value
        )
    );
}


/* =========================================================
   PDF.JS RENDERER
   ========================================================= */

async function renderPdf(
  url,
  containerId,
  pageInfoId
) {

  const container =
    $(containerId);

  const pageInfo =
    $(pageInfoId);

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="pdf-loading">
      Loading question paper...
    </div>
  `;

  if (!window.pdfjsLib) {

    container.innerHTML = `
      <div class="pdf-loading">
        PDF viewer could not be loaded.
      </div>
    `;

    return;
  }

  try {

    const loadingTask =
      window.pdfjsLib.getDocument({
        url,
        withCredentials: false
      });

    const pdf =
      await loadingTask.promise;

    container.innerHTML = "";

    if (pageInfo) {
      pageInfo.textContent =
        `1 / ${pdf.numPages}`;
    }

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {

      const page =
        await pdf.getPage(
          pageNumber
        );

      const baseViewport =
        page.getViewport({
          scale: 1
        });

      const containerWidth =
        Math.max(
          container.clientWidth - 20,
          280
        );

      const scale =
        containerWidth /
        baseViewport.width;

      const viewport =
        page.getViewport({
          scale
        });

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.className =
        "pdf-page";

      canvas.width =
        Math.floor(
          viewport.width
        );

      canvas.height =
        Math.floor(
          viewport.height
        );

      const context =
        canvas.getContext(
          "2d"
        );

      container.appendChild(
        canvas
      );

      await page.render({
        canvasContext:
          context,
        viewport
      }).promise;
    }

    if (pageInfo) {
      pageInfo.textContent =
        `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}`;
    }

  } catch (error) {

    console.error(
      "PDF render error:",
      error
    );

    container.innerHTML = `
      <div class="pdf-loading">
        Could not display this PDF inside the page.
        Please check the PDF URL.
      </div>
    `;
  }
}


/* =========================================================
   CREATE PDF
   ========================================================= */

$("pdfFile").addEventListener(
  "change",
  async (event) => {

    const file =
      event.target.files[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    currentPdfUrl = "";

    hide(previewBox);

    if (!file) {
      status.textContent = "";
      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {

      event.target.value = "";

      status.textContent =
        "Please select a PDF file.";

      return;
    }

    const localUrl =
      URL.createObjectURL(
        file
      );

    status.textContent =
      `${file.name} selected.`;

    status.style.color =
      "#16a34a";

    show(previewBox);

    await renderPdf(
      localUrl,
      "createPdfViewer",
      "createPdfPageInfo"
    );
  }
);


/* =========================================================
   PDF UPLOAD
   ========================================================= */

async function uploadQuestionPaper(
  file,
  code
) {

  if (!file) {
    throw new Error(
      "Please select a question paper PDF."
    );
  }

  const fileName =
    `${code}-${Date.now()}.pdf`;

  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(
        fileName,
        file,
        {
          cacheControl:
            "3600",
          upsert:
            false,
          contentType:
            "application/pdf"
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data
  } =
    supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(
        fileName
      );

  if (
    !data ||
    !data.publicUrl
  ) {
    throw new Error(
      "Could not create PDF URL."
    );
  }

  return data.publicUrl;
}


/* =========================================================
   ANSWER KEY
   ========================================================= */

function renderAnswerKey() {

  const container =
    $("answerKeyGrid");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  currentAnswerKey =
    new Array(
      currentQuestionCount
    ).fill("");

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "answer-key-item";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      `Question ${i + 1}`;

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "answer-key-select";

    select.dataset.question =
      String(i);

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(
        optionCount
      );

    select.innerHTML =
      `
        <option value="">
          Select
        </option>
      ` +
      labels
        .map(
          (label) =>
            `
              <option value="${label}">
                ${label}
              </option>
            `
        )
        .join("");

    select.addEventListener(
      "change",
      () => {

        currentAnswerKey[i] =
          select.value;

        updateAnswerKeyBadge();
      }
    );

    item.appendChild(
      title
    );

    item.appendChild(
      select
    );

    container.appendChild(
      item
    );
  }

  updateAnswerKeyBadge();
}


function collectAnswerKey() {

  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  return Array
    .from(selects)
    .map(
      (select) =>
        select.value
    );
}


function updateAnswerKeyBadge() {

  const badge =
    $("answerCountBadge");

  if (!badge) {
    return;
  }

  const answers =
    collectAnswerKey();

  const count =
    answers.filter(
      Boolean
    ).length;

  badge.textContent =
    `${count} / ${currentQuestionCount}`;
}


/* =========================================================
   BULK ANSWER PARSER
   ========================================================= */

function parseBulkAnswers(
  rawText
) {

  const cleaned =
    String(rawText || "")
      .toUpperCase()
      .replace(/[^A-D]/g, " ");

  return cleaned
    .split(/\s+/)
    .map(
      (value) =>
        value.trim()
    )
    .filter(Boolean);
}


function validateBulkAnswers(
  answers
) {

  const errors = [];

  if (
    answers.length !==
    currentQuestionCount
  ) {

    errors.push(
      `Expected ${currentQuestionCount} answers, but detected ${answers.length}.`
    );
  }

  const limit =
    Math.min(
      answers.length,
      currentQuestionCount
    );

  for (
    let i = 0;
    i < limit;
    i++
  ) {

    const answer =
      answers[i];

    const optionCount =
      currentOptions[i] || 4;

    const validOptions =
      getOptionLabels(
        optionCount
      );

    if (
      !validOptions.includes(
        answer
      )
    ) {

      errors.push(
        `Q${i + 1}: ${answer} is invalid. Allowed: ${validOptions.join("/")}.`
      );
    }
  }

  return errors;
}


function applyBulkAnswerKey() {

  const input =
    $("bulkAnswerInput");

  const status =
    $("bulkAnswerStatus");

  const raw =
    input.value.trim();

  if (!raw) {

    showStatus(
      status,
      "Please paste your answer key first.",
      "error"
    );

    return;
  }

  const answers =
    parseBulkAnswers(
      raw
    );

  const errors =
    validateBulkAnswers(
      answers
    );

  if (errors.length > 0) {

    showStatus(
      status,
      errors.slice(0, 5).join(" "),
      "error"
    );

    return;
  }

  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  answers.forEach(
    (answer, index) => {

      if (!selects[index]) {
        return;
      }

      selects[index].value =
        answer;

      currentAnswerKey[index] =
        answer;
    }
  );

  updateAnswerKeyBadge();

  showStatus(
    status,
    `${answers.length} answers applied successfully.`,
    "success"
  );
}


/* =========================================================
   CREATE TEST
   ========================================================= */

$("generateBtn").addEventListener(
  "click",
  async () => {

    const name =
      $("testName")
        .value
        .trim();

    const pdfFile =
      $("pdfFile")
        .files[0];

    const questionCount =
      Number(
        $("questionCount")
          .value
      );

    if (!name) {

      alert(
        "Please enter a test name."
      );

      return;
    }

    if (!pdfFile) {

      alert(
        "Please select the question paper PDF."
      );

      return;
    }

    if (
      !Number.isInteger(
        questionCount
      ) ||
      questionCount < 1 ||
      questionCount > MAX_QUESTIONS
    ) {

      alert(
        `Question count must be between 1 and ${MAX_QUESTIONS}.`
      );

      return;
    }

    currentQuestionCount =
      questionCount;

    currentOptions =
      collectQuestionOptions();

    if (
      currentOptions.length !==
      currentQuestionCount
    ) {

      renderOptionSettings();

      currentOptions =
        collectQuestionOptions();
    }

    setLoading(
      true,
      "Preparing your test..."
    );

    try {

      const code =
        await generateUniqueTestCode();

      setLoading(
        true,
        "Uploading question paper..."
      );

      currentPdfUrl =
        await uploadQuestionPaper(
          pdfFile,
          code
        );

      currentTest = {
        name,
        code,
        pdf_url:
          currentPdfUrl,
        question_count:
          currentQuestionCount,
        options:
          currentOptions
      };

      renderAnswerKey();

      $("bulkAnswerInput")
        .value = "";

      hideStatus(
        $("bulkAnswerStatus")
      );

      showScreen(
        "answerKeyScreen"
      );

    } catch (error) {

      console.error(error);

      alert(
        "Could not prepare the test.\n\n" +
        error.message
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   SAVE TEST
   ========================================================= */

$("saveTestBtn").addEventListener(
  "click",
  async () => {

    if (!currentTest) {

      alert(
        "No test is ready to save."
      );

      return;
    }

    const answerKey =
      collectAnswerKey();

    const missingAnswers =
      answerKey.some(
        (answer) => !answer
      );

    if (missingAnswers) {

      showStatus(
        $("saveStatus"),
        "Please provide the correct answer for every question.",
        "error"
      );

      return;
    }

    const correctMark =
      Number(
        $("correctMark").value
      );

    const wrongMark =
      Number(
        $("wrongMark").value
      );

    if (
      !Number.isFinite(
        correctMark
      )
    ) {

      showStatus(
        $("saveStatus"),
        "Please enter a valid correct mark.",
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(
        wrongMark
      )
    ) {

      showStatus(
        $("saveStatus"),
        "Please enter a valid negative mark.",
        "error"
      );

      return;
    }

    setLoading(
      true,
      "Saving test..."
    );

    try {

      const payload = {

        name:
          currentTest.name,

        pdf_url:
          currentTest.pdf_url,

        question_count:
          currentTest.question_count,

        options:
          currentTest.options,

        answer_key:
          answerKey,

        correct_mark:
          correctMark,

        wrong_mark:
          wrongMark,

        code:
          currentTest.code
      };

      const {
        data,
        error
      } =
        await supabaseClient
          .from("tests")
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw error;
      }

      testCreatedCode =
        data.code;

      $("createdCode")
        .textContent =
        testCreatedCode;

      showScreen(
        "createdScreen"
      );

    } catch (error) {

      console.error(error);

      showStatus(
        $("saveStatus"),
        "Could not save the test: " +
          error.message,
        "error"
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   LOAD TEST
   ========================================================= */

async function loadTestByCode(
  code
) {

  const cleanCode =
    code
      .trim()
      .toUpperCase();

  if (!cleanCode) {
    throw new Error(
      "Please enter the test code."
    );
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select("*")
      .eq("code", cleanCode)
      .limit(1);

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.length === 0
  ) {

    throw new Error(
      "Test not found. Please check the code."
    );
  }

  return data[0];
}


/* =========================================================
   JOIN
   ========================================================= */

$("joinBtn").addEventListener(
  "click",
  async () => {

    const code =
      $("joinCode")
        .value
        .trim()
        .toUpperCase();

    const status =
      $("joinStatus");

    hideStatus(status);

    if (!code) {

      showStatus(
        status,
        "Please enter the test code.",
        "error"
      );

      return;
    }

    setLoading(
      true,
      "Loading test..."
    );

    try {

      const test =
        await loadTestByCode(
          code
        );

      currentTest =
        test;

      currentQuestionCount =
        Number(
          test.question_count
        );

      currentOptions =
        Array.isArray(
          test.options
        )
          ? test.options.map(
              normalizeOptionCount
            )
          : new Array(
              currentQuestionCount
            ).fill(4);

      currentAnswerKey =
        Array.isArray(
          test.answer_key
        )
          ? test.answer_key
          : [];

      selectedAnswers =
        new Array(
          currentQuestionCount
        ).fill("");

      $("studentTestName")
        .textContent =
        test.name;

      $("studentTestCode")
        .textContent =
        `Code: ${test.code}`;

      $("studentTestInfo")
        .textContent =
        `${currentQuestionCount} questions. Enter your details to begin.`;

      showScreen(
        "studentScreen"
      );

    } catch (error) {

      console.error(error);

      showStatus(
        status,
        error.message,
        "error"
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   STUDENT DETAILS
   ========================================================= */

$("startExamBtn").addEventListener(
  "click",
  async () => {

    if (!currentTest) {
      return;
    }

    const name =
      $("studentName")
        .value
        .trim();

    const roll =
      $("studentRoll")
        .value
        .trim();

    const section =
      $("studentSection")
        .value
        .trim();

    const status =
      $("studentStatus");

    hideStatus(status);

    if (!name) {

      showStatus(
        status,
        "Please enter your name.",
        "error"
      );

      return;
    }

    currentStudent = {
      name,
      roll,
      section
    };

    $("examName")
      .textContent =
      currentTest.name;

    $("examInfo")
      .textContent =
      `${currentQuestionCount} Questions • Code: ${currentTest.code}`;

    $("examStudentName")
      .textContent =
      name;

    $("examStudentInfo")
      .textContent =
      `Roll ${roll || "—"}${section ? ` • Section ${section}` : ""}`;

    const avatar =
      $("examStudentBar")
        .querySelector(
          ".student-mini-avatar"
        );

    if (avatar) {
      avatar.textContent =
        name
          .charAt(0)
          .toUpperCase();
    }

    renderExam();

    await renderPdf(
      currentTest.pdf_url,
      "examPdfViewer",
      "examPdfPageInfo"
    );

    showScreen(
      "examScreen"
    );

    startExamTimer();

  }
);


/* =========================================================
   EXAM RENDER
   ========================================================= */

function renderExam() {

  const container =
    $("examGrid");

  container.innerHTML = "";

  selectedAnswers =
    new Array(
      currentQuestionCount
    ).fill("");

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "exam-question";

    row.id =
      `question-row-${i}`;

    const number =
      document.createElement(
        "div"
      );

    number.className =
      "question-number";

    number.textContent =
      i + 1;

    row.appendChild(
      number
    );

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(
        optionCount
      );

    labels.forEach(
      (option) => {

        const label =
          document.createElement(
            "label"
          );

        label.className =
          "answer-option";

        const input =
          document.createElement(
            "input"
          );

        input.type =
          "radio";

        input.name =
          `question-${i}`;

        input.value =
          option;

        input.dataset.question =
          String(i);

        input.addEventListener(
          "change",
          () => {

            selectedAnswers[i] =
              input.value;

            updateSelectedOption(
              i,
              input.value
            );

            updateProgress();

            updateQuestionNavigator();
          }
        );

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          option;

        label.appendChild(
          input
        );

        label.appendChild(
          text
        );

        row.appendChild(
          label
        );
      }
    );

    container.appendChild(
      row
    );
  }

  renderQuestionNavigator();

  updateProgress();
}


/* =========================================================
   SELECTED OPTION
   ========================================================= */

function updateSelectedOption(
  questionIndex,
  selectedValue
) {

  const inputs =
    document.querySelectorAll(
      `input[name="question-${questionIndex}"]`
    );

  inputs.forEach(
    (input) => {

      const label =
        input.closest(
          ".answer-option"
        );

      if (!label) {
        return;
      }

      if (
        input.value ===
        selectedValue
      ) {

        label.classList.add(
          "selected"
        );

      } else {

        label.classList.remove(
          "selected"
        );
      }
    }
  );
}


/* =========================================================
   PROGRESS
   ========================================================= */

function updateProgress() {

  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const progress =
    $("questionProgress");

  if (progress) {

    progress.textContent =
      `${answered} / ${currentQuestionCount}`;
  }
}


/* =========================================================
   QUESTION NAVIGATOR
   ========================================================= */

function renderQuestionNavigator() {

  const container =
    $("questionNavigator");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "nav-question";

    button.textContent =
      i + 1;

    button.dataset.index =
      String(i);

    button.addEventListener(
      "click",
      () => {

        const row =
          $(`question-row-${i}`);

        if (row) {

          row.scrollIntoView({
            behavior:
              "smooth",
            block:
              "center"
          });
        }
      }
    );

    container.appendChild(
      button
    );
  }

  updateQuestionNavigator();
}


function updateQuestionNavigator() {

  const buttons =
    document.querySelectorAll(
      ".nav-question"
    );

  buttons.forEach(
    (button, index) => {

      button.classList.toggle(
        "answered",
        Boolean(
          selectedAnswers[index]
        )
      );
    }
  );
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn").addEventListener(
  "click",
  async () => {

    if (!currentTest) {
      return;
    }

    const unanswered =
      selectedAnswers.filter(
        (answer) => !answer
      ).length;

    if (unanswered > 0) {

      const proceed =
        confirm(
          `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
        );

      if (!proceed) {
        return;
      }
    }

    stopExamTimer();

    setLoading(
      true,
      "Checking your answers..."
    );

    try {

      const result =
        calculateResult();

      currentResult =
        result;

      await saveResult(
        result
      );

      renderResult(
        result
      );

    } catch (error) {

      console.error(error);

      alert(
        "The result was calculated, but could not be saved.\n\n" +
        error.message
      );

      renderResult(
        currentResult
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   CALCULATE RESULT
   ========================================================= */

function calculateResult() {

  const answerKey =
    Array.isArray(
      currentTest.answer_key
    )
      ? currentTest.answer_key
      : [];

  const correctMark =
    Number(
      currentTest.correct_mark
    ) || 0;

  const wrongMark =
    Number(
      currentTest.wrong_mark
    ) || 0;

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const selected =
      selectedAnswers[i];

    const correctAnswer =
      answerKey[i];

    if (!selected) {

      unanswered++;

      continue;
    }

    if (
      selected ===
      correctAnswer
    ) {

      correct++;

    } else {

      wrong++;
    }
  }

  const score =
    (
      correct *
      correctMark
    ) -
    (
      wrong *
      Math.abs(
        wrongMark
      )
    );

  const totalMarks =
    currentQuestionCount *
    correctMark;

  const accuracy =
    currentQuestionCount > 0
      ? (
          correct /
          currentQuestionCount
        ) * 100
      : 0;

  return {
    correct,
    wrong,
    unanswered,
    score,
    totalMarks,
    accuracy
  };
}


/* =========================================================
   SAVE RESULT
   ========================================================= */

async function saveResult(
  result
) {

  if (!currentTest) {
    throw new Error(
      "No test is active."
    );
  }

  const resultCode =
    generateResultCode();

  const payload = {

    result_code:
      resultCode,

    test_id:
      currentTest.id,

    test_code:
      currentTest.code,

    student_name:
      currentStudent.name,

    roll_number:
      currentStudent.roll ||
      null,

    section:
      currentStudent.section ||
      null,

    answers:
      selectedAnswers,

    correct:
      result.correct,

    wrong:
      result.wrong,

    unanswered:
      result.unanswered,

    score:
      Number(
        result.score.toFixed(4)
      ),

    total_marks:
      Number(
        result.totalMarks.toFixed(4)
      ),

    accuracy:
      Number(
        result.accuracy.toFixed(2)
      )
  };

  const {
    data,
    error
  } =
    await supabaseClient
      .from("results")
      .insert(payload)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   RESULT CODE
   ========================================================= */

function generateResultCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      characters[
        Math.floor(
          Math.random() *
          characters.length
        )
      ];
  }

  return code;
}


/* =========================================================
   RESULT UI
   ========================================================= */

function renderResult(
  result
) {

  const resultBox =
    $("resultBox");

  if (!resultBox) {
    return;
  }

  resultBox.innerHTML = `

    <div class="result-title">
      Test Completed
    </div>

    <div class="result-student-name">

      ${escapeHtml(
        currentStudent.name
      )}

      <span>
        Roll:
        ${escapeHtml(
          currentStudent.roll ||
          "—"
        )}
      </span>

    </div>


    <div class="result-stats">

      <div class="result-stat">
        <span>Correct</span>
        <strong>
          ${result.correct}
        </strong>
      </div>

      <div class="result-stat">
        <span>Wrong</span>
        <strong>
          ${result.wrong}
        </strong>
      </div>

      <div class="result-stat">
        <span>Unanswered</span>
        <strong>
          ${result.unanswered}
        </strong>
      </div>

      <div class="result-stat">
        <span>Accuracy</span>
        <strong>
          ${result.accuracy.toFixed(2)}%
        </strong>
      </div>

    </div>


    <div class="score-display">

      <span>
        Score
      </span>

      <strong>
        ${formatNumber(
          result.score
        )}
        /
        ${formatNumber(
          result.totalMarks
        )}
      </strong>

    </div>

  `;

  show(resultBox);

  resultBox.scrollIntoView({
    behavior:
      "smooth",
    block:
      "nearest"
  });
}


/* =========================================================
   FORMAT
   ========================================================= */

function formatNumber(
  number
) {

  return Number(number)
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );
}


function escapeHtml(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   RESET EXAM
   ========================================================= */

$("resetExamBtn").addEventListener(
  "click",
  () => {

    const confirmed =
      confirm(
        "Are you sure you want to clear all answers?"
      );

    if (!confirmed) {
      return;
    }

    selectedAnswers =
      new Array(
        currentQuestionCount
      ).fill("");

    document
      .querySelectorAll(
        "#examGrid input[type='radio']"
      )
      .forEach(
        (input) => {

          input.checked =
            false;

          const label =
            input.closest(
              ".answer-option"
            );

          if (label) {

            label.classList.remove(
              "selected"
            );
          }
        }
      );

    hide(
      $("resultBox")
    );

    updateProgress();

    updateQuestionNavigator();
  }
);


/* =========================================================
   TIMER
   ========================================================= */

function startExamTimer() {

  stopExamTimer();

  /*
     Current tests do not yet contain
     a duration field.

     Therefore the timer remains hidden
     until duration is added to a test.
  */

  if (
    !currentTest.duration_minutes
  ) {

    hide(
      $("examTimer")
    );

    return;
  }

  examSecondsRemaining =
    Number(
      currentTest.duration_minutes
    ) * 60;

  show(
    $("examTimer")
  );

  updateTimerUI();

  examTimerInterval =
    setInterval(
      () => {

        examSecondsRemaining--;

        updateTimerUI();

        if (
          examSecondsRemaining <= 0
        ) {

          stopExamTimer();

          alert(
            "Time is over. Your exam will be submitted."
          );

          $("submitExamBtn").click();
        }

      },
      1000
    );
}


function stopExamTimer() {

  if (
    examTimerInterval
  ) {

    clearInterval(
      examTimerInterval
    );

    examTimerInterval =
      null;
  }
}


function updateTimerUI() {

  const timer =
    $("examTimer");

  if (!timer) {
    return;
  }

  const minutes =
    Math.floor(
      examSecondsRemaining /
      60
    );

  const seconds =
    examSecondsRemaining %
    60;

  timer.textContent =
    `⏱ ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  timer.classList.toggle(
    "warning",
    examSecondsRemaining <= 300
  );
}


/* =========================================================
   RESULTS
   ========================================================= */

$("showResultsBtn").addEventListener(
  "click",
  () => {

    $("resultTestCode")
      .value = "";

    hideStatus(
      $("resultsStatus")
    );

    hide(
      $("resultsSummary")
    );

    hide(
      $("resultsTableWrapper")
    );

    showScreen(
      "resultsScreen"
    );
  }
);


$("checkResultsBtn").addEventListener(
  "click",
  async () => {

    const code =
      $("resultTestCode")
        .value
        .trim()
        .toUpperCase();

    const status =
      $("resultsStatus");

    hideStatus(status);

    hide(
      $("resultsSummary")
    );

    hide(
      $("resultsTableWrapper")
    );

    if (!code) {

      showStatus(
        status,
        "Please enter the Test Code.",
        "error"
      );

      return;
    }

    setLoading(
      true,
      "Loading results..."
    );

    try {

      const results =
        await loadResultsByTestCode(
          code
        );

      renderResultsDashboard(
        results,
        code
      );

    } catch (error) {

      console.error(error);

      showStatus(
        status,
        error.message,
        "error"
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   LOAD RESULTS
   ========================================================= */

async function loadResultsByTestCode(
  testCode
) {

  const cleanCode =
    testCode
      .trim()
      .toUpperCase();

  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "get_results_by_test_code",
        {
          p_test_code:
            cleanCode
        }
      );

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.length === 0
  ) {

    throw new Error(
      "No submitted results were found for this Test Code."
    );
  }

  return data;
}


/* =========================================================
   RESULTS DASHBOARD
   ========================================================= */

function renderResultsDashboard(
  results,
  testCode
) {

  const summary =
    $("resultsSummary");

  const tableWrapper =
    $("resultsTableWrapper");

  if (!summary ||
      !tableWrapper) {
    return;
  }

  const sortedResults =
    [...results].sort(
      (
        a,
        b
      ) =>
        Number(b.score) -
        Number(a.score)
    );

  const total =
    sortedResults.length;

  const highestScore =
    Math.max(
      ...sortedResults.map(
        (item) =>
          Number(item.score)
      )
    );

  const averageScore =
    sortedResults.reduce(
      (
        totalScore,
        item
      ) =>
        totalScore +
        Number(item.score),
      0
    ) / total;

  summary.innerHTML = `

    <div class="summary-item">
      <span>Students</span>
      <strong>
        ${total}
      </strong>
    </div>

    <div class="summary-item">
      <span>Highest Score</span>
      <strong>
        ${formatNumber(
          highestScore
        )}
      </strong>
    </div>

    <div class="summary-item">
      <span>Average Score</span>
      <strong>
        ${formatNumber(
          averageScore
        )}
      </strong>
    </div>

    <div class="summary-item">
      <span>Test Code</span>
      <strong>
        ${escapeHtml(
          testCode
        )}
      </strong>
    </div>

  `;

  tableWrapper.innerHTML = `

    <table class="results-table">

      <thead>

        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Roll</th>
          <th>Section</th>
          <th>Correct</th>
          <th>Wrong</th>
          <th>Skipped</th>
          <th>Score</th>
          <th>Accuracy</th>
        </tr>

      </thead>

      <tbody>

        ${sortedResults
          .map(
            (
              result,
              index
            ) => `

              <tr>

                <td class="rank">
                  ${index + 1}
                </td>

                <td>
                  ${escapeHtml(
                    result.student_name
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    result.roll_number ||
                    "—"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    result.section ||
                    "—"
                  )}
                </td>

                <td>
                  ${result.correct}
                </td>

                <td>
                  ${result.wrong}
                </td>

                <td>
                  ${result.unanswered}
                </td>

                <td class="score">
                  ${formatNumber(
                    result.score
                  )}
                  /
                  ${formatNumber(
                    result.total_marks
                  )}
                </td>

                <td class="accuracy">
                  ${Number(
                    result.accuracy
                  ).toFixed(2)}%
                </td>

              </tr>

            `
          )
          .join("")}

      </tbody>

    </table>
  `;

  show(
    summary
  );

  show(
    tableWrapper
  );
}


/* =========================================================
   COPY TEST CODE
   ========================================================= */

$("copyCodeBtn").addEventListener(
  "click",
  async () => {

    const code =
      $("createdCode")
        .textContent
        .trim();

    if (!code) {
      return;
    }

    try {

      await navigator
        .clipboard
        .writeText(
          code
        );

      $("copyCodeBtn")
        .textContent =
        "Copied!";

      setTimeout(
        () => {

          $("copyCodeBtn")
            .textContent =
            "Copy Code";

        },
        1500
      );

    } catch (error) {

      alert(
        `Test Code: ${code}`
      );
    }
  }
);


/* =========================================================
   NAVIGATION
   ========================================================= */

$("showCreateBtn").addEventListener(
  "click",
  () => {

    resetCreateForm();

    showScreen(
      "createScreen"
    );
  }
);


$("showJoinBtn").addEventListener(
  "click",
  () => {

    $("joinCode")
      .value = "";

    hideStatus(
      $("joinStatus")
    );

    showScreen(
      "joinScreen"
    );
  }
);


$("backHomeFromCreate").addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );
  }
);


$("backHomeFromJoin").addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );
  }
);


$("backHomeFromResults").addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );
  }
);


$("backToCreateBtn").addEventListener(
  "click",
  () => {

    showScreen(
      "createScreen"
    );
  }
);


$("backToJoinBtn").addEventListener(
  "click",
  () => {

    showScreen(
      "joinScreen"
    );
  }
);


$("goHomeAfterCreate").addEventListener(
  "click",
  () => {

    resetCreateForm();

    showScreen(
      "homeScreen"
    );
  }
);


$("exitExamBtn").addEventListener(
  "click",
  () => {

    const confirmed =
      confirm(
        "Leave this test?"
      );

    if (!confirmed) {
      return;
    }

    stopExamTimer();

    currentTest =
      null;

    selectedAnswers =
      [];

    currentStudent = {
      name: "",
      roll: "",
      section: ""
    };

    showScreen(
      "homeScreen"
    );
  }
);


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

function resetCreateForm() {

  $("testName")
    .value = "";

  $("pdfFile")
    .value = "";

  $("questionCount")
    .value = "40";

  $("defaultOptions")
    .value = "4";

  $("pdfStatus")
    .textContent = "";

  $("bulkAnswerInput")
    .value = "";

  $("correctMark")
    .value = "1";

  $("wrongMark")
    .value = "0";

  $("createPdfViewer")
    .innerHTML = "";

  $("createPdfPageInfo")
    .textContent = "0 / 0";

  hide(
    $("pdfPreviewBox")
  );

  hideStatus(
    $("bulkAnswerStatus")
  );

  hideStatus(
    $("saveStatus")
  );

  currentPdfUrl =
    "";

  currentTest =
    null;

  currentOptions =
    [];

  currentAnswerKey =
    [];

  testCreatedCode =
    "";

  renderOptionSettings();
}


$("clearCreateBtn").addEventListener(
  "click",
  () => {

    const confirmed =
      confirm(
        "Clear all test creation data?"
      );

    if (!confirmed) {
      return;
    }

    resetCreateForm();
  }
);


/* =========================================================
   QUESTION COUNT
   ========================================================= */

$("questionCount").addEventListener(
  "input",
  () => {

    const count =
      Number(
        $("questionCount").value
      );

    if (
      !Number.isInteger(
        count
      ) ||
      count < 1 ||
      count > MAX_QUESTIONS
    ) {
      return;
    }

    renderOptionSettings();
  }
);


/* =========================================================
   DEFAULT OPTIONS
   ========================================================= */

$("defaultOptions").addEventListener(
  "change",
  () => {

    renderOptionSettings();
  }
);


/* =========================================================
   BULK ANSWER BUTTONS
   ========================================================= */

$("applyBulkAnswerBtn").addEventListener(
  "click",
  () => {

    applyBulkAnswerKey();
  }
);


$("clearBulkAnswerBtn").addEventListener(
  "click",
  () => {

    $("bulkAnswerInput")
      .value = "";

    hideStatus(
      $("bulkAnswerStatus")
    );
  }
);


/* =========================================================
   JOIN CODE INPUT
   ========================================================= */

$("joinCode").addEventListener(
  "input",
  (event) => {

    event.target.value =
      event.target.value
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ""
        )
        .slice(0, 6);
  }
);


$("joinCode").addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      $("joinBtn").click();
    }
  }
);


/* =========================================================
   RESULT CODE INPUT
   ========================================================= */

$("resultTestCode").addEventListener(
  "input",
  (event) => {

    event.target.value =
      event.target.value
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ""
        )
        .slice(0, 6);
  }
);


$("resultTestCode").addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      $("checkResultsBtn")
        .click();
    }
  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeApp() {

  renderOptionSettings();

  showScreen(
    "homeScreen"
  );

  console.log(
    "Exam OMR V2 initialized."
  );
}


initializeApp();
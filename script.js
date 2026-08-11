/* =========================================================
   EXAM OMR
   Main JavaScript
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  "https://veanswqdgwffiespeokc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IuXKh35oKJiu3_a3HKurkw_YSURgtdT";


const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_BUCKET = "question-papers";

const OPTION_LABELS = ["A", "B", "C", "D"];


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


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);


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


function setLoading(showLoading, text = "Please wait...") {
  const overlay = $("loadingOverlay");
  const loadingText = $("loadingText");

  if (loadingText) {
    loadingText.textContent = text;
  }

  if (showLoading) {
    show(overlay);
  } else {
    hide(overlay);
  }
}


function showStatus(element, message, type = "") {
  if (!element) {
    return;
  }

  element.textContent = message;

  element.className = "status-box";

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
  const screens = document.querySelectorAll(".screen");

  screens.forEach((screen) => {
    hide(screen);
  });

  const target = $(screenId);

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
      Math.floor(Math.random() * characters.length);

    code += characters[randomIndex];
  }

  return code;
}


async function generateUniqueTestCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateTestCode();

    const { data, error } =
      await supabaseClient
        .from("tests")
        .select("id")
        .eq("code", code)
        .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
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

function getOptionLabels(optionCount) {
  return OPTION_LABELS.slice(0, optionCount);
}


function normalizeOptionCount(value) {
  const number = Number(value);

  return number === 2 ? 2 : 4;
}


/* =========================================================
   CREATE TEST - OPTION SETTINGS
   ========================================================= */

function renderOptionSettings() {
  const container = $("optionSettings");

  if (!container) {
    return;
  }

  const count =
    Math.max(
      1,
      Math.min(
        300,
        Number($("questionCount").value) || 40
      )
    );

  const defaultOptionCount =
    normalizeOptionCount(
      $("defaultOptions").value
    );

  currentQuestionCount = count;

  container.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const wrapper =
      document.createElement("div");

    wrapper.className = "option-setting";

    const number =
      document.createElement("div");

    number.className =
      "option-setting-number";

    number.textContent = i;

    const select =
      document.createElement("select");

    select.className =
      "question-option-count";

    select.dataset.question = String(i);

    select.innerHTML = `
      <option value="4">4 Options</option>
      <option value="2">2 Options</option>
    `;

    select.value =
      String(defaultOptionCount);

    wrapper.appendChild(number);
    wrapper.appendChild(select);

    container.appendChild(wrapper);
  }
}


function collectQuestionOptions() {
  const selects =
    document.querySelectorAll(
      ".question-option-count"
    );

  return Array.from(selects).map((select) =>
    normalizeOptionCount(select.value)
  );
}


/* =========================================================
   CREATE TEST - PDF
   ========================================================= */

$("pdfFile").addEventListener(
  "change",
  (event) => {
    const file =
      event.target.files[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    const preview =
      $("pdfPreview");

    currentPdfUrl = "";

    hide(previewBox);

    if (!file) {
      status.textContent = "";
      return;
    }

    if (file.type !== "application/pdf") {
      event.target.value = "";

      status.textContent =
        "Please select a PDF file.";

      return;
    }

    const localUrl =
      URL.createObjectURL(file);

    preview.src = localUrl;

    show(previewBox);

    status.textContent =
      `${file.name} selected.`;

    status.style.color = "#16a34a";
  }
);


/* =========================================================
   PDF UPLOAD
   ========================================================= */

async function uploadQuestionPaper(file, code) {
  if (!file) {
    throw new Error(
      "Please select a question paper PDF."
    );
  }

  const extension = "pdf";

  const fileName =
    `${code}-${Date.now()}.${extension}`;

  const filePath =
    fileName;

  const { error: uploadError } =
    await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(
        filePath,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf"
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data } =
    supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

  if (!data || !data.publicUrl) {
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
    new Array(currentQuestionCount)
      .fill("");

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {
    const item =
      document.createElement("div");

    item.className =
      "answer-key-item";

    const title =
      document.createElement("strong");

    title.textContent =
      `Question ${i + 1}`;

    const select =
      document.createElement("select");

    select.className =
      "answer-key-select";

    select.dataset.question =
      String(i);

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(optionCount);

    select.innerHTML =
      `<option value="">Select</option>` +
      labels
        .map(
          (label) =>
            `<option value="${label}">${label}</option>`
        )
        .join("");

    select.addEventListener(
      "change",
      () => {
        currentAnswerKey[i] =
          select.value;
      }
    );

    item.appendChild(title);
    item.appendChild(select);

    container.appendChild(item);
  }
}


function collectAnswerKey() {
  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  return Array.from(selects).map(
    (select) => select.value
  );
}


/* =========================================================
   CREATE TEST
   ========================================================= */

$("generateBtn").addEventListener(
  "click",
  async () => {

    const name =
      $("testName").value.trim();

    const pdfFile =
      $("pdfFile").files[0];

    const questionCount =
      Number($("questionCount").value);

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
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > 300
    ) {
      alert(
        "Question count must be between 1 and 300."
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

      renderAnswerKey();

      currentTest = {
        name,
        code,
        pdf_url: currentPdfUrl,
        question_count:
          currentQuestionCount,
        options:
          currentOptions
      };

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
      alert(
        "Please select the correct answer for every question."
      );
      return;
    }

    const correctMark =
      Number($("correctMark").value);

    const wrongMark =
      Number($("wrongMark").value);

    if (!Number.isFinite(correctMark)) {
      alert(
        "Please enter a valid correct mark."
      );
      return;
    }

    if (!Number.isFinite(wrongMark)) {
      alert(
        "Please enter a valid wrong mark."
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

      const { data, error } =
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

      $("createdCode").textContent =
        testCreatedCode;

      showScreen(
        "createdScreen"
      );

    } catch (error) {

      console.error(error);

      alert(
        "Could not save the test.\n\n" +
        error.message
      );

    } finally {

      setLoading(false);
    }
  }
);


/* =========================================================
   JOIN TEST
   ========================================================= */

async function loadTestByCode(code) {
  const cleanCode =
    code
      .trim()
      .toUpperCase();

  if (!cleanCode) {
    throw new Error(
      "Please enter a test code."
    );
  }

  const { data, error } =
    await supabaseClient
      .from("tests")
      .select("*")
      .eq("code", cleanCode)
      .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Test not found. Please check the code."
    );
  }

  return data[0];
}


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
        await loadTestByCode(code);

      currentTest =
        test;

      currentQuestionCount =
        Number(test.question_count);

      currentOptions =
        Array.isArray(test.options)
          ? test.options.map(
              normalizeOptionCount
            )
          : new Array(
              currentQuestionCount
            ).fill(4);

      currentAnswerKey =
        Array.isArray(test.answer_key)
          ? test.answer_key
          : [];

      selectedAnswers =
        new Array(
          currentQuestionCount
        ).fill("");

      $("examName").textContent =
        test.name;

      $("examInfo").textContent =
        `${currentQuestionCount} Questions • Code: ${test.code}`;

      $("examPdf").src =
        test.pdf_url;

      renderExam();

      showScreen(
        "examScreen"
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
   EXAM OMR
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
      document.createElement("div");

    row.className =
      "exam-question";

    const number =
      document.createElement("div");

    number.className =
      "question-number";

    number.textContent =
      i + 1;

    row.appendChild(number);

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(optionCount);

    for (
      let j = 0;
      j < labels.length;
      j++
    ) {

      const label =
        document.createElement("label");

      label.className =
        "answer-option";

      const input =
        document.createElement("input");

      input.type = "radio";

      input.name =
        `question-${i}`;

      input.value =
        labels[j];

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
        }
      );

      label.appendChild(input);

      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        labels[j];

      label.appendChild(text);

      row.appendChild(label);
    }

    container.appendChild(row);
  }

  updateProgress();
}


function updateSelectedOption(
  questionIndex,
  selectedValue
) {

  const inputs =
    document.querySelectorAll(
      `input[name="question-${questionIndex}"]`
    );

  inputs.forEach((input) => {

    const label =
      input.closest(
        ".answer-option"
      );

    if (!label) {
      return;
    }

    if (
      input.value === selectedValue
    ) {
      label.classList.add(
        "selected"
      );
    } else {
      label.classList.remove(
        "selected"
      );
    }
  });
}


function updateProgress() {
  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const total =
    currentQuestionCount;

  const progress =
    $("questionProgress");

  if (progress) {
    progress.textContent =
      `${answered} / ${total}`;
  }
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn").addEventListener(
  "click",
  () => {

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

    calculateResult();
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
      selected === correctAnswer
    ) {

      correct++;

    } else {

      wrong++;
    }
  }

  const score =
    (
      correct * correctMark
    ) -
    (
      wrong * Math.abs(wrongMark)
    );

  const totalMarks =
    currentQuestionCount *
    correctMark;

  renderResult({
    correct,
    wrong,
    unanswered,
    score,
    totalMarks
  });
}


/* =========================================================
   RESULT UI
   ========================================================= */

function renderResult(result) {

  const resultBox =
    $("resultBox");

  const percentage =
  currentQuestionCount > 0
    ? (
        result.correct /
        currentQuestionCount
      ) * 100
    : 0;

  resultBox.innerHTML = `
    <div class="result-title">
      Result
    </div>

    <div class="result-stats">

      <div class="result-stat">
        <span>Correct</span>
        <strong>${result.correct}</strong>
      </div>

      <div class="result-stat">
        <span>Wrong</span>
        <strong>${result.wrong}</strong>
      </div>

      <div class="result-stat">
        <span>Unanswered</span>
        <strong>${result.unanswered}</strong>
      </div>

      <div class="result-stat">
        <span>Percentage</span>
        <strong>${percentage.toFixed(2)}%</strong>
      </div>

    </div>

    <div class="score-display">

      <span>Score</span>

      <strong>
        ${formatNumber(result.score)}
        /
        ${formatNumber(result.totalMarks)}
      </strong>

    </div>
  `;

  show(resultBox);

  resultBox.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


function formatNumber(number) {
  return Number(number)
    .toFixed(2)
    .replace(/\.00$/, "");
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

    const inputs =
      document.querySelectorAll(
        "#examGrid input[type='radio']"
      );

    inputs.forEach((input) => {
      input.checked = false;

      const label =
        input.closest(
          ".answer-option"
        );

      if (label) {
        label.classList.remove(
          "selected"
        );
      }
    });

    hide($("resultBox"));

    updateProgress();
  }
);


/* =========================================================
   COPY TEST CODE
   ========================================================= */

$("copyCodeBtn").addEventListener(
  "click",
  async () => {

    const code =
      $("createdCode").textContent.trim();

    if (!code) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        code
      );

      $("copyCodeBtn").textContent =
        "Copied!";

      setTimeout(() => {

        $("copyCodeBtn").textContent =
          "Copy Code";

      }, 1500);

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

    $("joinCode").value = "";

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


$("backToCreateBtn").addEventListener(
  "click",
  () => {

    showScreen(
      "createScreen"
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

    currentTest = null;

    selectedAnswers = [];

    showScreen(
      "homeScreen"
    );
  }
);


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

function resetCreateForm() {

  $("testName").value = "";

  $("pdfFile").value = "";

  $("questionCount").value = "40";

  $("defaultOptions").value = "4";

  $("pdfStatus").textContent = "";

  $("pdfPreview").src = "";

  hide(
    $("pdfPreviewBox")
  );

  currentPdfUrl = "";

  currentTest = null;

  currentOptions = [];

  currentAnswerKey = [];

  testCreatedCode = "";

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
   QUESTION COUNT CHANGE
   ========================================================= */

$("questionCount").addEventListener(
  "input",
  () => {

    const count =
      Number(
        $("questionCount").value
      );

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 300
    ) {
      return;
    }

    renderOptionSettings();
  }
);


/* =========================================================
   DEFAULT OPTION CHANGE
   ========================================================= */

$("defaultOptions").addEventListener(
  "change",
  () => {

    renderOptionSettings();
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
      event.key === "Enter"
    ) {
      $("joinBtn").click();
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
    "Exam OMR initialized."
  );
}


initializeApp();
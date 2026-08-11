/* =========================================================
   EXAM OMR — FINAL script.js
   ========================================================= */

const SUPABASE_URL = "https://veanswqdgwffiespeokc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IuXKh35oKJiu3_a3HKurkw_YSURgtdT";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const STORAGE_BUCKET = "question-papers";

const OPTION_LABELS = ["A", "B", "C", "D"];

const PDFJS_VERSION = "4.10.38";

const PDFJS_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;

const PDFJS_WORKER_CDN =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;


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

let candidateName = "";

let pdfJsModule = null;

let currentPdfDocument = null;

let currentPdfPage = 1;

let currentPdfScale = 1;

let pdfRendering = false;

let pendingPdfRender = null;

let pdfRenderToken = 0;


/* =========================================================
   DOM HELPERS
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
  active,
  text = "Please wait..."
) {

  if ($("loadingText")) {
    $("loadingText").textContent = text;
  }

  if (active) {
    show($("loadingOverlay"));
  } else {
    hide($("loadingOverlay"));
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

  hide(element);

}


function showScreen(screenId) {

  document
    .querySelectorAll(".screen")
    .forEach((screen) => {
      hide(screen);
    });

  show($(screenId));

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function formatNumber(value) {

  return Number(value || 0)
    .toFixed(2)
    .replace(/\.00$/, "");

}


/* =========================================================
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(count) {

  return OPTION_LABELS.slice(
    0,
    Number(count) === 2 ? 2 : 4
  );

}


function normalizeOptionCount(value) {

  return Number(value) === 2
    ? 2
    : 4;

}


/* =========================================================
   TEST CODE
   ========================================================= */

function generateTestCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array
    .from(
      { length: 6 },
      () =>
        characters[
          Math.floor(
            Math.random() *
            characters.length
          )
        ]
    )
    .join("");

}


async function generateUniqueTestCode() {

  for (
    let attempt = 0;
    attempt < 15;
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

    if (!data || data.length === 0) {
      return code;
    }

  }

  throw new Error(
    "Could not generate a unique test code."
  );

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
        300,
        Number(
          $("questionCount")?.value
        ) || 40
      )
    );

  const defaultCount =
    normalizeOptionCount(
      $("defaultOptions")?.value
    );

  currentQuestionCount =
    count;

  container.innerHTML =
    "";

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

    wrapper.innerHTML = `
      <div class="option-setting-number">
        ${i}
      </div>

      <select
        class="question-option-count"
        data-question="${i}"
      >
        <option
          value="4"
          ${defaultCount === 4 ? "selected" : ""}
        >
          4 Options
        </option>

        <option
          value="2"
          ${defaultCount === 2 ? "selected" : ""}
        >
          2 Options
        </option>
      </select>
    `;

    container.appendChild(
      wrapper
    );

  }

}


function collectQuestionOptions() {

  return Array
    .from(
      document.querySelectorAll(
        ".question-option-count"
      )
    )
    .map(
      (select) =>
        normalizeOptionCount(
          select.value
        )
    );

}


/* =========================================================
   PDF FILE SELECTION
   ========================================================= */

$("pdfFile")?.addEventListener(
  "change",
  (event) => {

    const file =
      event.target.files?.[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    const preview =
      $("pdfPreview");

    hide(previewBox);

    if (!file) {

      if (status) {
        status.textContent =
          "";
      }

      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {

      event.target.value =
        "";

      if (status) {
        status.textContent =
          "Please select a PDF file.";
      }

      return;
    }

    const url =
      URL.createObjectURL(
        file
      );

    if (preview) {
      preview.src =
        url;
    }

    show(previewBox);

    if (status) {

      status.textContent =
        `${file.name} selected.`;

      status.style.color =
        "#16a34a";

    }

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
    error
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

  if (error) {
    throw error;
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

  container.innerHTML =
    "";

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

    const labels =
      getOptionLabels(
        currentOptions[i] || 4
      );

    item.innerHTML = `
      <strong>
        Question ${i + 1}
      </strong>

      <select
        class="answer-key-select"
        data-question="${i}"
      >

        <option value="">
          Select
        </option>

        ${labels
          .map(
            (label) =>
              `<option value="${label}">
                ${label}
              </option>`
          )
          .join("")}

      </select>
    `;

    const select =
      item.querySelector(
        "select"
      );

    select.addEventListener(
      "change",
      () => {

        currentAnswerKey[i] =
          select.value;

      }
    );

    container.appendChild(
      item
    );

  }

}


function collectAnswerKey() {

  return Array
    .from(
      document.querySelectorAll(
        ".answer-key-select"
      )
    )
    .map(
      (select) =>
        select.value
    );

}


/* =========================================================
   GENERATE TEST
   ========================================================= */

$("generateBtn")?.addEventListener(
  "click",
  async () => {

    const name =
      $("testName")
        ?.value
        .trim();

    const pdfFile =
      $("pdfFile")
        ?.files?.[0];

    const questionCount =
      Number(
        $("questionCount")
          ?.value
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
      questionCount
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

        pdf_url:
          currentPdfUrl,

        question_count:
          currentQuestionCount,

        options:
          currentOptions

      };

      showScreen(
        "answerKeyScreen"
      );

    } catch (error) {

      console.error(
        error
      );

      alert(
        "Could not prepare the test.\n\n" +
        error.message
      );

    } finally {

      setLoading(
        false
      );

    }

  }
);


/* =========================================================
   SAVE TEST
   ========================================================= */

$("saveTestBtn")?.addEventListener(
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

    if (
      answerKey.some(
        (answer) =>
          !answer
      )
    ) {

      alert(
        "Please select the correct answer for every question."
      );

      return;
    }

    const correctMark =
      Number(
        $("correctMark")
          ?.value
      );

    const wrongMark =
      Number(
        $("wrongMark")
          ?.value
      );

    if (
      !Number.isFinite(
        correctMark
      )
    ) {

      alert(
        "Please enter a valid correct mark."
      );

      return;
    }

    if (
      !Number.isFinite(
        wrongMark
      )
    ) {

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

      const {
        data,
        error
      } =
        await supabaseClient
          .from("tests")
          .insert(
            payload
          )
          .select()
          .single();

      if (error) {
        throw error;
      }

      testCreatedCode =
        data.code;

      if ($("createdCode")) {

        $("createdCode")
          .textContent =
          testCreatedCode;

      }

      showScreen(
        "createdScreen"
      );

    } catch (error) {

      console.error(
        error
      );

      alert(
        "Could not save the test.\n\n" +
        error.message
      );

    } finally {

      setLoading(
        false
      );

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
      "Please enter a test code."
    );

  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select("*")
      .eq(
        "code",
        cleanCode
      )
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
   CANDIDATE NAME
   ========================================================= */

function ensureCandidateNameInput() {

  if ($("candidateName")) {
    return;
  }

  const examScreen =
    $("examScreen");

  const header =
    examScreen?.querySelector(
      ".exam-header"
    );

  if (!header) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "candidate-bar card";

  wrapper.innerHTML = `

    <div class="candidate-bar-icon">
      👤
    </div>

    <div class="candidate-bar-info">

      <label class="form-label">
        Candidate Name
      </label>

      <p>
        Enter your name before starting the exam.
      </p>

    </div>

    <input
      id="candidateName"
      type="text"
      maxlength="100"
      autocomplete="name"
      placeholder="Enter your full name"
    >

  `;

  header.parentNode.insertBefore(
    wrapper,
    header.nextSibling
  );

}


/* =========================================================
   JOIN TEST
   ========================================================= */

$("joinBtn")?.addEventListener(
  "click",
  async () => {

    const code =
      $("joinCode")
        ?.value
        .trim()
        .toUpperCase();

    const status =
      $("joinStatus");

    hideStatus(
      status
    );

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

      currentTest =
        await loadTestByCode(
          code
        );

      currentQuestionCount =
        Number(
          currentTest.question_count
        );

      currentOptions =
        Array.isArray(
          currentTest.options
        )
          ? currentTest.options.map(
              normalizeOptionCount
            )
          : new Array(
              currentQuestionCount
            ).fill(4);

      currentAnswerKey =
        Array.isArray(
          currentTest.answer_key
        )
          ? currentTest.answer_key
          : [];

      selectedAnswers =
        new Array(
          currentQuestionCount
        ).fill("");

      candidateName =
        "";

      if ($("examName")) {

        $("examName")
          .textContent =
          currentTest.name;

      }

      if ($("examInfo")) {

        $("examInfo")
          .textContent =
          `${currentQuestionCount} Questions • Code: ${currentTest.code}`;

      }

      currentPdfUrl =
        currentTest.pdf_url;

      ensureCandidateNameInput();

      if ($("candidateName")) {

        $("candidateName")
          .value =
          "";

      }

      await initializePdfViewer(
        currentPdfUrl
      );

      renderExam();

      showScreen(
        "examScreen"
      );

    } catch (error) {

      console.error(
        error
      );

      showStatus(
        status,
        error.message,
        "error"
      );

    } finally {

      setLoading(
        false
      );

    }

  }
);


/* =========================================================
   EXAM OMR
   ========================================================= */

function renderExam() {

  const container =
    $("examGrid");

  if (!container) {
    return;
  }

  container.innerHTML =
    "";

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

    const labels =
      getOptionLabels(
        currentOptions[i] || 4
      );

    for (
      const labelValue of labels
    ) {

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
        labelValue;

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

      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        labelValue;

      label.append(
        input,
        text
      );

      row.appendChild(
        label
      );

    }

    container.appendChild(
      row
    );

  }

  updateProgress();

}


function updateSelectedOption(
  questionIndex,
  selectedValue
) {

  document
    .querySelectorAll(
      `input[name="question-${questionIndex}"]`
    )
    .forEach(
      (input) => {

        const label =
          input.closest(
            ".answer-option"
          );

        if (label) {

          label.classList.toggle(
            "selected",
            input.value ===
              selectedValue
          );

        }

      }
    );

}


function updateProgress() {

  const answered =
    selectedAnswers.filter(
      Boolean
    ).length;

  const total =
    currentQuestionCount;

  if ($("questionProgress")) {

    $("questionProgress")
      .textContent =
      `${answered} / ${total}`;

  }

  const fill =
    document.querySelector(
      ".progress-fill"
    );

  if (fill) {

    fill.style.width =
      `${
        total
          ? (answered / total) * 100
          : 0
      }%`;

  }

  const strong =
    document.querySelector(
      ".omr-progress strong"
    );

  if (strong) {

    strong.textContent =
      `${answered}/${total}`;

  }

}


/* =========================================================
   RESET EXAM
   ========================================================= */

$("resetExamBtn")?.addEventListener(
  "click",
  () => {

    if (
      !confirm(
        "Delete all selected answers?"
      )
    ) {

      return;

    }

    selectedAnswers =
      new Array(
        currentQuestionCount
      ).fill("");

    document
      .querySelectorAll(
        ".answer-option input"
      )
      .forEach(
        (input) => {

          input.checked =
            false;

        }
      );

    document
      .querySelectorAll(
        ".answer-option.selected"
      )
      .forEach(
        (label) => {

          label.classList.remove(
            "selected"
          );

        }
      );

    hide(
      $("resultBox")
    );

    updateProgress();

  }
);


/* =========================================================
   CALCULATE RESULT
   ========================================================= */

function calculateResult() {

  const answerKey =
    Array.isArray(
      currentTest?.answer_key
    )
      ? currentTest.answer_key
      : [];

  const correctMark =
    Number(
      currentTest?.correct_mark
    ) || 0;

  const wrongMark =
    Number(
      currentTest?.wrong_mark
    ) || 0;

  let correct =
    0;

  let wrong =
    0;

  let unanswered =
    0;

  for (
    let i = 0;
    i < currentQuestionCount;
    i++
  ) {

    const selected =
      selectedAnswers[i];

    if (!selected) {

      unanswered++;

      continue;
    }

    if (
      selected ===
      answerKey[i]
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

  const percentage =
    totalMarks > 0
      ? (
          score /
          totalMarks
        ) *
        100
      : 0;

  return {

    candidateName,

    testCode:
      currentTest.code,

    correct,

    wrong,

    unanswered,

    score,

    totalMarks,

    percentage,

    answers:
      selectedAnswers.slice()

  };

}


/* =========================================================
   SAVE RESULT
   =========================================================

   Matches the result table:

   test_code
   candidate_name
   answers
   correct_count
   wrong_count
   unanswered_count
   score
   total_marks
   percentage
   submitted_at

   ========================================================= */

async function saveExamResult(
  result
) {

  const payload = {

    test_code:
      result.testCode,

    candidate_name:
      result.candidateName,

    answers:
      result.answers,

    correct_count:
      result.correct,

    wrong_count:
      result.wrong,

    unanswered_count:
      result.unanswered,

    score:
      result.score,

    total_marks:
      result.totalMarks,

    percentage:
      result.percentage,

    submitted_at:
      new Date().toISOString()

  };

  const {
    error
  } =
    await supabaseClient
      .from("exam_results")
      .insert(
        payload
      );

  if (error) {
    throw error;
  }

}


/* =========================================================
   RESULT UI
   ========================================================= */

function renderResult(
  result
) {

  const box =
    $("resultBox");

  if (!box) {
    return;
  }

  box.innerHTML = `

    <div class="result-title">
      Result
    </div>

    <p>
      ${escapeHtml(
        result.candidateName
      )}
      •
      ${escapeHtml(
        currentTest.name
      )}
    </p>

    <div class="result-stats">

      <div class="result-stat">

        <span>
          Correct
        </span>

        <strong>
          ${result.correct}
        </strong>

      </div>

      <div class="result-stat">

        <span>
          Wrong
        </span>

        <strong>
          ${result.wrong}
        </strong>

      </div>

      <div class="result-stat">

        <span>
          Unanswered
        </span>

        <strong>
          ${result.unanswered}
        </strong>

      </div>

      <div class="result-stat">

        <span>
          Percentage
        </span>

        <strong>
          ${result.percentage.toFixed(2)}%
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

  show(box);

  box.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });

}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

$("submitExamBtn")?.addEventListener(
  "click",
  async () => {

    if (!currentTest) {
      return;
    }

    const input =
      $("candidateName");

    candidateName =
      input?.value
        ?.trim() ||
      "";

    if (!candidateName) {

      alert(
        "Please enter your name before submitting the exam."
      );

      input?.focus();

      return;
    }

    const unanswered =
      selectedAnswers.filter(
        (answer) =>
          !answer
      ).length;

    if (
      unanswered > 0
    ) {

      const proceed =
        confirm(
          `${unanswered} question(s) are unanswered.\n\nSubmit anyway?`
        );

      if (!proceed) {
        return;
      }

    }

    setLoading(
      true,
      "Checking your answers..."
    );

    const result =
      calculateResult();

    try {

      await saveExamResult(
        result
      );

    } catch (error) {

      console.error(
        error
      );

      alert(
        "Your result was calculated, but could not be saved.\n\n" +
        error.message
      );

    }

    renderResult(
      result
    );

    setLoading(
      false
    );

  }
);


/* =========================================================
   PDF.JS LOADER
   ========================================================= */

async function loadPdfJs() {

  if (pdfJsModule) {
    return pdfJsModule;
  }

  try {

    pdfJsModule =
      await import(
        PDFJS_CDN
      );

    pdfJsModule
      .GlobalWorkerOptions
      .workerSrc =
      PDFJS_WORKER_CDN;

    return pdfJsModule;

  } catch (error) {

    console.error(
      "PDF.js failed to load:",
      error
    );

    throw new Error(
      "Could not load the PDF viewer."
    );

  }

}


/* =========================================================
   PDF VIEWER CONTAINER
   ========================================================= */

function getPdfViewerContainer() {

  const existing =
    $("pdfCanvasContainer");

  if (existing) {
    return existing;
  }

  const iframe =
    $("examPdf");

  if (!iframe) {
    return null;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "pdf-viewer";

  wrapper.innerHTML = `

    <div class="pdf-toolbar">

      <div class="pdf-toolbar-group">

        <button
          type="button"
          class="pdf-control"
          id="pdfPrevBtn"
          title="Previous page"
        >
          ‹
        </button>

        <span
          class="pdf-page-info"
          id="pdfPageInfo"
        >
          1 / 1
        </span>

        <button
          type="button"
          class="pdf-control"
          id="pdfNextBtn"
          title="Next page"
        >
          ›
        </button>

      </div>


      <div class="pdf-toolbar-group">

        <button
          type="button"
          class="pdf-control"
          id="pdfZoomOutBtn"
          title="Zoom out"
        >
          −
        </button>

        <span
          class="pdf-zoom-value"
          id="pdfZoomValue"
        >
          100%
        </span>

        <button
          type="button"
          class="pdf-control"
          id="pdfZoomInBtn"
          title="Zoom in"
        >
          +
        </button>

      </div>

    </div>


    <div
      class="pdf-canvas-container"
      id="pdfCanvasContainer"
    >

      <div
        class="pdf-loading"
        id="pdfLoading"
      >
        Loading question paper...
      </div>

      <canvas
        id="pdfCanvas"
      ></canvas>

    </div>


    <div class="pdf-viewer-footer">

      <span>
        Question Paper
      </span>

      <a
        id="pdfOpenFallback"
        class="pdf-open-fallback"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open PDF
      </a>

    </div>

  `;

  iframe.style.display =
    "none";

  iframe.parentNode.insertBefore(
    wrapper,
    iframe
  );

  attachPdfControls();

  return $(
    "pdfCanvasContainer"
  );

}


/* =========================================================
   PDF CONTROLS
   ========================================================= */

function attachPdfControls() {

  $("pdfPrevBtn")?.addEventListener(
    "click",
    () => {

      if (
        !currentPdfDocument ||
        currentPdfPage <= 1
      ) {

        return;

      }

      currentPdfPage--;

      renderPdfPage(
        currentPdfPage
      );

    }
  );


  $("pdfNextBtn")?.addEventListener(
    "click",
    () => {

      if (
        !currentPdfDocument ||
        currentPdfPage >=
          currentPdfDocument.numPages
      ) {

        return;

      }

      currentPdfPage++;

      renderPdfPage(
        currentPdfPage
      );

    }
  );


  $("pdfZoomOutBtn")?.addEventListener(
    "click",
    () => {

      currentPdfScale =
        Math.max(
          0.5,
          Math.round(
            (
              currentPdfScale -
              0.1
            ) *
            100
          ) /
            100
        );

      updatePdfZoomText();

      renderPdfPage(
        currentPdfPage
      );

    }
  );


  $("pdfZoomInBtn")?.addEventListener(
    "click",
    () => {

      currentPdfScale =
        Math.min(
          3,
          Math.round(
            (
              currentPdfScale +
              0.1
            ) *
            100
          ) /
            100
        );

      updatePdfZoomText();

      renderPdfPage(
        currentPdfPage
      );

    }
  );

}


/* =========================================================
   INITIAL PDF SCALE
   ========================================================= */

async function getInitialPdfScale() {

  const container =
    $("pdfCanvasContainer");

  if (
    !container ||
    !currentPdfDocument
  ) {

    return 1;

  }

  try {

    const page =
      await currentPdfDocument
        .getPage(1);

    const viewport =
      page.getViewport({
        scale: 1
      });

    const availableWidth =
      Math.max(
        280,
        container.clientWidth -
          36
      );

    return Math.max(
      0.5,
      Math.min(
        1.5,
        availableWidth /
          viewport.width
      )
    );

  } catch (error) {

    console.warn(
      "Could not calculate initial PDF scale:",
      error
    );

    return 1;

  }

}


/* =========================================================
   INITIALIZE PDF VIEWER
   ========================================================= */

async function initializePdfViewer(
  url
) {

  currentPdfUrl =
    url;

  currentPdfDocument =
    null;

  pdfRendering =
    false;

  pendingPdfRender =
    null;

  pdfRenderToken++;

  const container =
    getPdfViewerContainer();

  if (!container) {
    return;
  }

  /*
    IMPORTANT FOR MOBILE / ANDROID:
    The canvas itself can become larger than the
    viewer when zoomed.
  */

  container.style.overflow =
    "auto";

  container.style.webkitOverflowScrolling =
    "touch";

  const loading =
    $("pdfLoading");

  const canvas =
    $("pdfCanvas");

  if (loading) {

    loading.innerHTML =
      "Loading question paper...";

    show(loading);

  }

  if (canvas) {

    canvas.style.display =
      "none";

  }

  try {

    const pdfjsLib =
      await loadPdfJs();

    const token =
      pdfRenderToken;

    const documentProxy =
      await pdfjsLib
        .getDocument({
          url,
          withCredentials:
            false
        })
        .promise;

    if (
      token !==
      pdfRenderToken
    ) {

      return;

    }

    currentPdfDocument =
      documentProxy;

    currentPdfPage =
      1;

    currentPdfScale =
      await getInitialPdfScale();

    updatePdfZoomText();

    const fallback =
      $("pdfOpenFallback");

    if (fallback) {

      fallback.href =
        url;

    }

    await renderPdfPage(
      1
    );

  } catch (error) {

    console.error(
      "PDF viewer error:",
      error
    );

    if (loading) {

      loading.innerHTML = `
        <strong>
          PDF preview unavailable
        </strong>

        <span>
          Use "Open PDF" to view it.
        </span>
      `;

      show(loading);

    }

    const iframe =
      $("examPdf");

    if (iframe) {

      iframe.style.display =
        "block";

      iframe.src =
        url;

    }

  }

}


/* =========================================================
   RENDER PDF PAGE
   =========================================================

   THIS IS THE IMPORTANT FIX.

   The old code automatically fitted every viewport
   back to the available container width.

   Therefore:

   100% → click + → 110%
   → code immediately reduced it back to fit width.

   So zoom appeared not to work.

   This version DOES NOT do that.

   ========================================================= */

async function renderPdfPage(
  pageNumber
) {

  if (!currentPdfDocument) {
    return;
  }


  /*
    If a render is already running,
    remember the newest request instead
    of simply ignoring the click.
  */

  if (pdfRendering) {

    pendingPdfRender = {

      pageNumber,

      scale:
        currentPdfScale

    };

    return;

  }


  const canvas =
    $("pdfCanvas");

  const container =
    $("pdfCanvasContainer");

  if (
    !canvas ||
    !container
  ) {

    return;

  }


  pdfRendering =
    true;

  const documentAtStart =
    currentPdfDocument;

  const tokenAtStart =
    pdfRenderToken;

  const targetPage =
    Math.max(
      1,
      Math.min(
        pageNumber,
        documentAtStart.numPages
      )
    );

  const targetScale =
    currentPdfScale;


  try {

    const page =
      await documentAtStart
        .getPage(
          targetPage
        );

    if (
      tokenAtStart !==
        pdfRenderToken ||
      documentAtStart !==
        currentPdfDocument
    ) {

      return;

    }


    /*
      DO NOT FIT TO CONTAINER.

      This is what makes zoom actually work.
    */

    const viewport =
      page.getViewport({
        scale:
          targetScale
      });


    const deviceScale =
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      );


    canvas.width =
      Math.max(
        1,
        Math.floor(
          viewport.width *
            deviceScale
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.floor(
          viewport.height *
            deviceScale
        )
      );


    canvas.style.width =
      `${viewport.width}px`;

    canvas.style.height =
      `${viewport.height}px`;


    const context =
      canvas.getContext(
        "2d"
      );

    if (!context) {

      throw new Error(
        "Could not create PDF canvas context."
      );

    }


    context.setTransform(
      deviceScale,
      0,
      0,
      deviceScale,
      0,
      0
    );


    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    await page.render({

      canvasContext:
        context,

      viewport

    }).promise;


    if (
      tokenAtStart !==
        pdfRenderToken ||
      documentAtStart !==
        currentPdfDocument
    ) {

      return;

    }


    currentPdfPage =
      targetPage;

    currentPdfScale =
      targetScale;


    canvas.style.display =
      "block";


    hide(
      $("pdfLoading")
    );


    if ($("pdfPageInfo")) {

      $("pdfPageInfo")
        .textContent =
        `${currentPdfPage} / ${currentPdfDocument.numPages}`;

    }


    updatePdfButtons();

    updatePdfZoomText();


  } catch (error) {

    console.error(
      "PDF page render error:",
      error
    );

  } finally {

    pdfRendering =
      false;


    /*
      If user clicked next/zoom while
      rendering was happening, render
      the latest requested state now.
    */

    if (
      pendingPdfRender &&
      documentAtStart ===
        currentPdfDocument
    ) {

      const pending =
        pendingPdfRender;

      pendingPdfRender =
        null;

      currentPdfScale =
        pending.scale;

      requestAnimationFrame(
        () => {

          renderPdfPage(
            pending.pageNumber
          );

        }
      );

    } else {

      pendingPdfRender =
        null;

    }

  }

}


/* =========================================================
   PDF BUTTON STATE
   ========================================================= */

function updatePdfButtons() {

  const prev =
    $("pdfPrevBtn");

  const next =
    $("pdfNextBtn");


  if (prev) {

    prev.disabled =
      !currentPdfDocument ||
      currentPdfPage <= 1;

  }


  if (next) {

    next.disabled =
      !currentPdfDocument ||
      currentPdfPage >=
        currentPdfDocument.numPages;

  }

}


/* =========================================================
   PDF ZOOM TEXT
   ========================================================= */

function updatePdfZoomText() {

  const zoom =
    $("pdfZoomValue");

  if (zoom) {

    zoom.textContent =
      `${Math.round(
        currentPdfScale *
          100
      )}%`;

  }

}


/* =========================================================
   PDF RESIZE
   ========================================================= */

let pdfResizeTimer =
  null;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      pdfResizeTimer
    );

    pdfResizeTimer =
      setTimeout(
        () => {

          if (
            currentPdfDocument &&
            !pdfRendering
          ) {

            renderPdfPage(
              currentPdfPage
            );

          }

        },
        250
      );

  }
);


/* =========================================================
   COPY TEST CODE
   ========================================================= */

$("copyCodeBtn")?.addEventListener(
  "click",
  async () => {

    const code =
      $("createdCode")
        ?.textContent
        .trim();

    if (!code) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        code
      );

      const button =
        $("copyCodeBtn");

      const oldText =
        button?.textContent;

      if (button) {

        button.textContent =
          "Copied ✓";

      }

      setTimeout(
        () => {

          if (button) {

            button.textContent =
              oldText;

          }

        },
        1600
      );

    } catch {

      alert(
        `Test Code: ${code}`
      );

    }

  }
);


/* =========================================================
   HOME NAVIGATION
   ========================================================= */

$("showCreateBtn")?.addEventListener(
  "click",
  () => {

    showScreen(
      "createScreen"
    );

    renderOptionSettings();

  }
);


$("showJoinBtn")?.addEventListener(
  "click",
  () => {

    showScreen(
      "joinScreen"
    );

    $("joinCode")
      ?.focus();

  }
);


$("backHomeFromCreate")?.addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );

  }
);


$("backHomeFromJoin")?.addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );

  }
);


$("goHomeAfterCreate")?.addEventListener(
  "click",
  () => {

    showScreen(
      "homeScreen"
    );

  }
);


$("backToCreateBtn")?.addEventListener(
  "click",
  () => {

    showScreen(
      "createScreen"
    );

  }
);


/* =========================================================
   EXIT EXAM
   ========================================================= */

$("exitExamBtn")?.addEventListener(
  "click",
  () => {

    const answered =
      selectedAnswers.filter(
        Boolean
      ).length;

    if (
      answered > 0
    ) {

      const confirmed =
        confirm(
          "You have selected some answers.\n\nExit the exam?"
        );

      if (!confirmed) {
        return;
      }

    }

    /*
      Invalidate any PDF render that may
      still be in progress.
    */

    pdfRenderToken++;

    currentTest =
      null;

    currentPdfDocument =
      null;

    currentPdfUrl =
      "";

    selectedAnswers =
      [];

    candidateName =
      "";

    pendingPdfRender =
      null;

    showScreen(
      "homeScreen"
    );

  }
);


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

$("clearCreateBtn")?.addEventListener(
  "click",
  () => {

    const testName =
      $("testName");

    const pdfFile =
      $("pdfFile");

    const questionCount =
      $("questionCount");

    const pdfStatus =
      $("pdfStatus");

    if (testName) {

      testName.value =
        "";

    }

    if (pdfFile) {

      pdfFile.value =
        "";

    }

    if (questionCount) {

      questionCount.value =
        "40";

    }

    if (pdfStatus) {

      pdfStatus.textContent =
        "";

    }

    hide(
      $("pdfPreviewBox")
    );

    currentPdfUrl =
      "";

    currentTest =
      null;

    currentOptions =
      [];

    currentAnswerKey =
      [];

    renderOptionSettings();

  }
);


/* =========================================================
   QUESTION COUNT CHANGE
   ========================================================= */

$("questionCount")?.addEventListener(
  "change",
  () => {

    const count =
      Number(
        $("questionCount")
          ?.value
      );

    if (
      Number.isInteger(
        count
      ) &&
      count >= 1 &&
      count <= 300
    ) {

      renderOptionSettings();

    }

  }
);


/* =========================================================
   DEFAULT OPTION CHANGE
   ========================================================= */

$("defaultOptions")?.addEventListener(
  "change",
  () => {

    const value =
      normalizeOptionCount(
        $("defaultOptions")
          ?.value
      );

    document
      .querySelectorAll(
        ".question-option-count"
      )
      .forEach(
        (select) => {

          select.value =
            String(value);

        }
      );

  }
);


/* =========================================================
   JOIN CODE AUTO FORMAT
   ========================================================= */

$("joinCode")?.addEventListener(
  "input",
  (event) => {

    event.target.value =
      event.target.value
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ""
        )
        .slice(
          0,
          6
        );

  }
);


/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */

$("joinCode")?.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      $("joinBtn")
        ?.click();

    }

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderOptionSettings();

    const screens =
      document.querySelectorAll(
        ".screen"
      );

    const visible =
      Array
        .from(screens)
        .some(
          (screen) =>
            !screen.classList.contains(
              "hidden"
            )
        );

    if (!visible) {

      showScreen(
        "homeScreen"
      );

    }

  }
);


/* =========================================================
   GLOBAL ERROR PROTECTION
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "Unhandled promise rejection:",
      event.reason
    );

  }
);


/* =========================================================
   END
   ========================================================= */
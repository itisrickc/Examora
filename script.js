/* =========================================================
   EXAM OMR — FINAL script.js
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
   CONSTANTS
   ========================================================= */

const STORAGE_BUCKET =
  "question-papers";

const OPTION_LABELS =
  ["A", "B", "C", "D"];


/*
  We use the official Mozilla PDF.js viewer
  inside an iframe instead of rendering PDF pages
  ourselves on canvas.

  This is specifically intended to improve:
  - Android compatibility
  - zoom
  - page navigation
  - touch scrolling
*/

const PDFJS_VIEWER_URL =
  "https://mozilla.github.io/pdf.js/web/viewer.html";


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


/*
  PDF viewer state
*/

let currentPdfDocument = null;

let currentPdfPage = 1;

let currentPdfScale = 1;


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


function show(element) {

  if (element) {
    element.classList.remove(
      "hidden"
    );
  }

}


function hide(element) {

  if (element) {
    element.classList.add(
      "hidden"
    );
  }

}


function setLoading(
  active,
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

  if (active) {

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

    element.classList.add(
      type
    );

  }

  show(element);

}


function hideStatus(element) {

  if (!element) {
    return;
  }

  hide(element);

}


function showScreen(
  screenId
) {

  document
    .querySelectorAll(".screen")
    .forEach(
      (screen) => {

        hide(screen);

      }
    );

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


function escapeHtml(value) {

  return String(
    value ?? ""
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


function formatNumber(
  value
) {

  return Number(
    value || 0
  )
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );

}


/* =========================================================
   OPTION HELPERS
   ========================================================= */

function getOptionLabels(
  count
) {

  return OPTION_LABELS.slice(
    0,
    Number(count) === 2
      ? 2
      : 4
  );

}


function normalizeOptionCount(
  value
) {

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

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    const randomIndex =
      Math.floor(
        Math.random() *
        characters.length
      );

    code +=
      characters[
        randomIndex
      ];

  }

  return code;

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
        .eq(
          "code",
          code
        )
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
   CREATE TEST
   OPTION SETTINGS
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
          ${
            defaultCount === 4
              ? "selected"
              : ""
          }
        >
          4 Options
        </option>

        <option
          value="2"
          ${
            defaultCount === 2
              ? "selected"
              : ""
          }
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
      event.target
        ?.files?.[0];

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

        status.style.color =
          "#dc2626";

      }

      return;

    }

    const localUrl =
      URL.createObjectURL(
        file
      );

    if (preview) {

      preview.src =
        localUrl;

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
      .from(
        STORAGE_BUCKET
      )
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
      .from(
        STORAGE_BUCKET
      )
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
        currentOptions[i] ||
        4
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
              `
                <option value="${label}">
                  ${label}
                </option>
              `
          )
          .join("")}

      </select>
    `;

    const select =
      item.querySelector(
        ".answer-key-select"
      );

    select?.addEventListener(
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
        ?.trim();

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

    const missingAnswers =
      answerKey.some(
        (answer) =>
          !answer
      );

    if (missingAnswers) {

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
        ?.trim()
        ?.toUpperCase();

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
        currentOptions[i] ||
        4
      );

    for (
      const labelValue
      of labels
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
          ? (
              answered /
              total
            ) * 100
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
        ) * 100
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
      .from(
        "exam_results"
      )
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
   PDF VIEWER — PART 2
   ========================================================= */


/*
  IMPORTANT

  We are no longer rendering the PDF ourselves with canvas.

  Instead, the official Mozilla PDF.js viewer is loaded
  inside an iframe.

  This gives us:

  • Previous / Next page
  • Zoom in / out
  • Mobile touch support
  • Android PDF rendering
  • Page thumbnails
  • Search
  • Full-screen style PDF controls
*/


/* =========================================================
   PDF VIEWER URL
   ========================================================= */

function buildPdfViewerUrl(
  pdfUrl
) {

  if (!pdfUrl) {
    return "";
  }

  const encodedUrl =
    encodeURIComponent(
      pdfUrl
    );

  return (
    PDFJS_VIEWER_URL +
    `?file=${encodedUrl}`
  );

}


/* =========================================================
   CREATE MOBILE PDF VIEWER
   ========================================================= */

function createPdfViewer() {

  const pdfCard =
    document.querySelector(
      ".pdf-card"
    );

  if (!pdfCard) {
    return null;
  }


  /*
    If our viewer already exists,
    simply return it.
  */

  let viewer =
    $("mobilePdfViewer");

  if (viewer) {
    return viewer;
  }


  /*
    Hide the old iframe.

    We keep the original element in
    the DOM so existing HTML remains
    compatible.
  */

  const oldIframe =
    $("examPdf");

  if (oldIframe) {

    oldIframe.style.display =
      "none";

  }


  /*
    Create the new viewer.
  */

  viewer =
    document.createElement(
      "div"
    );

  viewer.id =
    "mobilePdfViewer";

  viewer.className =
    "mobile-pdf-viewer";


  viewer.innerHTML = `

    <div
      class="pdf-viewer-topbar"
    >

      <div
        class="pdf-viewer-title"
      >

        <span
          class="pdf-viewer-icon"
        >
          PDF
        </span>

        <span>
          Question Paper
        </span>

      </div>


      <button
        type="button"
        id="pdfFullscreenBtn"
        class="pdf-viewer-action"
        title="Open PDF viewer"
      >
        ⛶
      </button>

    </div>


    <div
      class="pdf-viewer-frame-wrap"
    >

      <iframe
        id="pdfViewerFrame"
        title="Question Paper PDF"
        class="pdf-viewer-frame"
        allowfullscreen
        loading="eager"
      >
      </iframe>

    </div>


    <div
      class="pdf-viewer-bottom"
    >

      <span>
        Use PDF controls to zoom and change pages.
      </span>

      <a
        id="pdfExternalLink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open PDF
      </a>

    </div>

  `;


  /*
    Insert our viewer immediately before
    the original iframe.
  */

  if (oldIframe) {

    oldIframe.parentNode.insertBefore(
      viewer,
      oldIframe
    );

  } else {

    pdfCard.appendChild(
      viewer
    );

  }


  attachPdfViewerControls();

  return viewer;

}


/* =========================================================
   PDF VIEWER CONTROLS
   ========================================================= */

function attachPdfViewerControls() {

  const fullscreenButton =
    $("pdfFullscreenBtn");

  if (
    fullscreenButton &&
    !fullscreenButton.dataset.bound
  ) {

    fullscreenButton.dataset.bound =
      "true";


    fullscreenButton.addEventListener(
      "click",
      () => {

        const frame =
          $("pdfViewerFrame");

        if (!frame) {
          return;
        }


        /*
          On Android browsers, opening the
          PDF.js viewer in a new browser
          context gives the user a reliable
          full-screen style PDF experience.

          The existing exam page remains
          unchanged.
        */

        if (currentPdfUrl) {

          const viewerUrl =
            buildPdfViewerUrl(
              currentPdfUrl
            );

          window.open(
            viewerUrl,
            "_blank",
            "noopener,noreferrer"
          );

        }

      }
    );

  }


  const externalLink =
    $("pdfExternalLink");

  if (externalLink) {

    externalLink.addEventListener(
      "click",
      () => {

        if (currentPdfUrl) {

          externalLink.href =
            currentPdfUrl;

        }

      }
    );

  }

}


/* =========================================================
   LOAD PDF INTO VIEWER
   ========================================================= */

function loadPdfIntoViewer(
  pdfUrl
) {

  if (!pdfUrl) {

    console.error(
      "No PDF URL supplied."
    );

    return;

  }


  const viewer =
    createPdfViewer();

  if (!viewer) {

    console.error(
      "Could not create PDF viewer."
    );

    return;

  }


  const frame =
    $("pdfViewerFrame");

  if (!frame) {

    console.error(
      "PDF viewer iframe not found."
    );

    return;

  }


  /*
    Build official PDF.js viewer URL.

    Example:

    https://mozilla.github.io/pdf.js/web/viewer.html
      ?file=https%3A%2F%2F...

  */

  const viewerUrl =
    buildPdfViewerUrl(
      pdfUrl
    );


  /*
    Avoid reloading the exact same PDF
    unnecessarily.
  */

  if (
    frame.dataset.pdfUrl ===
    pdfUrl
  ) {

    return;

  }


  frame.dataset.pdfUrl =
    pdfUrl;


  /*
    Set source.

    The PDF.js viewer itself handles
    page navigation and zoom.
  */

  frame.src =
    viewerUrl;


  /*
    Also update the direct PDF link.
  */

  const externalLink =
    $("pdfExternalLink");

  if (externalLink) {

    externalLink.href =
      pdfUrl;

  }

}


/* =========================================================
   PDF VIEWER INITIALIZATION
   ========================================================= */

async function initializePdfViewer(
  pdfUrl
) {

  currentPdfUrl =
    pdfUrl;

  currentPdfPage =
    1;

  currentPdfScale =
    1;


  if (!pdfUrl) {

    throw new Error(
      "Question paper PDF URL is missing."
    );

  }


  /*
    Create viewer and load PDF.
  */

  loadPdfIntoViewer(
    pdfUrl
  );


  /*
    Give the iframe a moment to start loading.
  */

  await new Promise(
    (resolve) => {

      setTimeout(
        resolve,
        150
      );

    }
  );

}


/* =========================================================
   PDF VIEWER REFRESH
   ========================================================= */

function refreshPdfViewer() {

  const frame =
    $("pdfViewerFrame");

  if (!frame) {
    return;
  }

  if (!currentPdfUrl) {
    return;
  }


  /*
    Force a fresh PDF.js viewer
    instance.

    This is useful when the same
    exam is opened again.
  */

  frame.dataset.pdfUrl =
    "";

  frame.src =
    buildPdfViewerUrl(
      currentPdfUrl
    );

}


/* =========================================================
   PDF VIEWER CLEANUP
   ========================================================= */

function destroyPdfViewer() {

  const frame =
    $("pdfViewerFrame");

  if (frame) {

    frame.src =
      "about:blank";

    frame.dataset.pdfUrl =
      "";

  }

  currentPdfUrl =
    "";

  currentPdfDocument =
    null;

  currentPdfPage =
    1;

  currentPdfScale =
    1;

}


/* =========================================================
   PDF FULLSCREEN FALLBACK
   ========================================================= */

function openPdfDirectly() {

  if (!currentPdfUrl) {

    alert(
      "Question paper PDF is not available."
    );

    return;

  }


  /*
    Try PDF.js first.
  */

  const viewerUrl =
    buildPdfViewerUrl(
      currentPdfUrl
    );


  const newWindow =
    window.open(
      viewerUrl,
      "_blank"
    );


  /*
    If browser blocks popup,
    use direct PDF URL.
  */

  if (!newWindow) {

    window.location.href =
      currentPdfUrl;

  }

}


/* =========================================================
   PDF VIEWER MESSAGE LISTENER
   =========================================================

   PDF.js is running inside an iframe.

   We don't control its internal DOM because
   it belongs to another document/origin.

   This listener is intentionally lightweight
   and does NOT modify the viewer.

   ========================================================= */

window.addEventListener(
  "message",
  (event) => {

    if (
      !event ||
      !event.data
    ) {

      return;

    }


    /*
      Keep this listener defensive.

      Different PDF.js versions may send
      different messages.
    */

    if (
      typeof event.data !==
      "object"
    ) {

      return;

    }

  }
);


/* =========================================================
   PDF VIEWER ERROR FALLBACK
   ========================================================= */

function showPdfFallback(
  message
) {

  const viewer =
    $("mobilePdfViewer");

  if (!viewer) {
    return;
  }


  const wrap =
    viewer.querySelector(
      ".pdf-viewer-frame-wrap"
    );

  if (!wrap) {
    return;
  }


  wrap.innerHTML = `

    <div
      class="pdf-fallback"
    >

      <div
        class="pdf-fallback-icon"
      >
        PDF
      </div>

      <h3>
        Question Paper
      </h3>

      <p>
        ${escapeHtml(
          message ||
          "The PDF preview could not be loaded."
        )}
      </p>

      <button
        type="button"
        id="pdfFallbackOpenBtn"
        class="primary-btn"
      >
        Open Question Paper
      </button>

    </div>

  `;


  $("pdfFallbackOpenBtn")
    ?.addEventListener(
      "click",
      openPdfDirectly
    );

}


/* =========================================================
   PDF FRAME LOAD EVENT
   ========================================================= */

function bindPdfFrameEvents() {

  const frame =
    $("pdfViewerFrame");

  if (!frame) {
    return;
  }


  if (
    frame.dataset.eventsBound ===
    "true"
  ) {

    return;

  }


  frame.dataset.eventsBound =
    "true";


  frame.addEventListener(
    "load",
    () => {

      /*
        The viewer has loaded.

        We deliberately don't try to
        access its internal DOM because
        cross-origin iframe restrictions
        would make that unreliable.
      */

      console.log(
        "PDF.js viewer loaded."
      );

    }
  );


  frame.addEventListener(
    "error",
    () => {

      showPdfFallback(
        "The PDF viewer could not be loaded on this device."
      );

    }
  );

}


/* =========================================================
   EXAM PDF SETUP
   ========================================================= */

function setupExamPdf() {

  const viewer =
    createPdfViewer();

  if (!viewer) {
    return;
  }

  bindPdfFrameEvents();

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

  if (!examScreen) {
    return;
  }

  const header =
    examScreen.querySelector(
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

    <div
      class="candidate-bar-icon"
    >
      👤
    </div>

    <div
      class="candidate-bar-info"
    >

      <label
        class="form-label"
      >
        Candidate Name
      </label>

      <p>
        Enter your name before submitting the exam.
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
   JOIN TEST — PDF VIEWER VERSION
   ========================================================= */

async function openExamWithTest(
  test
) {

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


  candidateName =
    "";


  if ($("examName")) {

    $("examName")
      .textContent =
      test.name;

  }


  if ($("examInfo")) {

    $("examInfo")
      .textContent =
      `${currentQuestionCount} Questions • Code: ${test.code}`;

  }


  /*
    Make sure candidate field exists.
  */

  ensureCandidateNameInput();


  if ($("candidateName")) {

    $("candidateName")
      .value =
      "";

  }


  /*
    IMPORTANT:

    Load PDF into the new PDF.js
    iframe viewer.

    We do NOT use:

      iframe.src = pdf_url

    because Android may open the
    browser's external PDF handler.

    Instead:

      pdf_url
        ↓
      Mozilla PDF.js viewer
        ↓
      iframe
  */

  await initializePdfViewer(
    test.pdf_url
  );


  setupExamPdf();


  renderExam();


  showScreen(
    "examScreen"
  );

}


/* =========================================================
   JOIN BUTTON
   ========================================================= */

$("joinBtn")?.addEventListener(
  "click",
  async () => {

    const code =
      $("joinCode")
        ?.value
        ?.trim()
        ?.toUpperCase();


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

      const test =
        await loadTestByCode(
          code
        );


      await openExamWithTest(
        test
      );


    } catch (error) {

      console.error(
        error
      );


      showStatus(
        status,
        error.message ||
          "Could not load the test.",
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
   EXAM EXIT
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


    destroyPdfViewer();


    currentTest =
      null;

    currentOptions =
      [];

    currentAnswerKey =
      [];

    selectedAnswers =
      [];

    candidateName =
      "";


    showScreen(
      "homeScreen"
    );

  }
);


/* =========================================================
   PDF VIEWER MOBILE RESIZE
   ========================================================= */

let pdfResizeTimeout =
  null;


window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      pdfResizeTimeout
    );


    pdfResizeTimeout =
      setTimeout(
        () => {

          const frame =
            $("pdfViewerFrame");

          if (!frame) {
            return;
          }

          /*
            Don't reload the PDF on resize.

            PDF.js internally handles its
            own responsive layout.
          */

        },
        250
      );

  }
);


/* =========================================================
   PDF VIEWER VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState !==
      "visible"
    ) {

      return;

    }


    /*
      Don't reload the viewer when
      returning to the tab/app.

      This prevents losing the current
      PDF page unnecessarily.
    */

  }
);


/* =========================================================
   END OF PART 2
   ========================================================= */
   /* =========================================================
   EXAM OMR — PART 3
   ========================================================= */


/* =========================================================
   OMR RENDERING
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


    /* -------------------------
       QUESTION NUMBER
       ------------------------- */

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


    /* -------------------------
       OPTIONS
       ------------------------- */

    const optionCount =
      currentOptions[i] || 4;

    const labels =
      getOptionLabels(
        optionCount
      );


    for (
      let j = 0;
      j < labels.length;
      j++
    ) {

      const value =
        labels[j];


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
        value;

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


      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        value;


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


    container.appendChild(
      row
    );

  }


  updateProgress();

}


/* =========================================================
   SELECTED OPTION UI
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


  const total =
    currentQuestionCount;


  const progress =
    $("questionProgress");


  if (progress) {

    progress.textContent =
      `${answered} / ${total}`;

  }


  /*
    Optional progress bar support.
    If the enhanced HTML/CSS contains
    one, it will automatically update.
  */

  const progressFill =
    document.querySelector(
      ".progress-fill"
    );


  if (progressFill) {

    const percentage =
      total > 0
        ? (
            answered /
            total
          ) * 100
        : 0;


    progressFill.style.width =
      `${percentage}%`;

  }


  const progressNumber =
    document.querySelector(
      ".omr-progress strong"
    );


  if (progressNumber) {

    progressNumber.textContent =
      `${answered}/${total}`;

  }

}


/* =========================================================
   RESET ANSWERS
   ========================================================= */

function resetExamAnswers() {

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


/* =========================================================
   RESET BUTTON
   ========================================================= */

$("resetExamBtn")?.addEventListener(
  "click",
  () => {

    const answered =
      selectedAnswers.filter(
        Boolean
      ).length;


    if (
      answered === 0
    ) {

      return;

    }


    const confirmed =
      confirm(
        "Delete all selected answers?"
      );


    if (!confirmed) {
      return;
    }


    resetExamAnswers();

  }
);


/* =========================================================
   RESULT CALCULATION
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


  const percentage =
    totalMarks > 0
      ? (
          score /
          totalMarks
        ) * 100
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
   SAVE EXAM RESULT
   ========================================================= */

async function saveExamResult(
  result
) {

  if (!result) {

    throw new Error(
      "Result data is missing."
    );

  }


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
      .from(
        "exam_results"
      )
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

  const resultBox =
    $("resultBox");


  if (!resultBox) {
    return;
  }


  resultBox.innerHTML = `

    <div class="result-title">
      Result
    </div>


    <p>
      <strong>
        ${escapeHtml(
          result.candidateName
        )}
      </strong>

      <br>

      ${escapeHtml(
        currentTest?.name ||
        "Exam"
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
          ${result.percentage.toFixed(
            2
          )}%
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


  show(
    resultBox
  );


  resultBox.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });

}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

async function submitExam() {

  if (!currentTest) {

    alert(
      "No active exam found."
    );

    return;

  }


  const nameInput =
    $("candidateName");


  candidateName =
    nameInput?.value
      ?.trim() ||
    "";


  if (!candidateName) {

    alert(
      "Please enter your name before submitting the exam."
    );


    nameInput?.focus();


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


  const submitButton =
    $("submitExamBtn");


  if (submitButton) {

    submitButton.disabled =
      true;

  }


  setLoading(
    true,
    "Checking your answers..."
  );


  try {

    const result =
      calculateResult();


    await saveExamResult(
      result
    );


    renderResult(
      result
    );


  } catch (error) {

    console.error(
      "Result submission error:",
      error
    );


    /*
      Even if database insertion fails,
      show the calculated result locally.
    */

    const result =
      calculateResult();


    renderResult(
      result
    );


    alert(
      "Your result was calculated, but it could not be saved online.\n\n" +
      (
        error?.message ||
        "Unknown error."
      )
    );


  } finally {

    setLoading(
      false
    );


    if (submitButton) {

      submitButton.disabled =
        false;

    }

  }

}


/* =========================================================
   SUBMIT BUTTON
   ========================================================= */

$("submitExamBtn")?.addEventListener(
  "click",
  submitExam
);


/* =========================================================
   COPY TEST CODE
   ========================================================= */

async function copyTestCode() {

  const code =
    $("createdCode")
      ?.textContent
      ?.trim();


  if (!code) {

    return;

  }


  try {

    await navigator.clipboard.writeText(
      code
    );


    const button =
      $("copyCodeBtn");


    if (button) {

      const originalText =
        button.textContent;


      button.textContent =
        "Copied ✓";


      setTimeout(
        () => {

          button.textContent =
            originalText;

        },
        1600
      );

    }

  } catch (error) {

    console.error(
      error
    );


    alert(
      `Test Code: ${code}`
    );

  }

}


$("copyCodeBtn")?.addEventListener(
  "click",
  copyTestCode
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


    setTimeout(
      () => {

        $("joinCode")
          ?.focus();

      },
      100
    );

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

      pdfStatus.style.color =
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
   DEFAULT OPTIONS CHANGE
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
   JOIN CODE INPUT
   ========================================================= */

$("joinCode")?.addEventListener(
  "input",
  (event) => {

    const input =
      event.target;


    input.value =
      input.value
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
   JOIN CODE ENTER KEY
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
   CANDIDATE NAME ENTER KEY
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Enter"
    ) {

      return;

    }


    const active =
      document.activeElement;


    if (
      active?.id !==
      "candidateName"
    ) {

      return;

    }


    event.preventDefault();


    $("submitExamBtn")
      ?.click();

  }
);


/* =========================================================
   BEFORE LEAVING EXAM
   ========================================================= */

window.addEventListener(
  "beforeunload",
  (event) => {

    const examScreen =
      $("examScreen");


    if (
      !examScreen ||
      examScreen.classList.contains(
        "hidden"
      )
    ) {

      return;

    }


    const answered =
      selectedAnswers.filter(
        Boolean
      ).length;


    if (
      answered <= 0
    ) {

      return;

    }


    event.preventDefault();

    event.returnValue =
      "";

  }
);


/* =========================================================
   MOBILE PDF VIEWER HELPERS
   ========================================================= */

function isAndroidDevice() {

  return /Android/i.test(
    navigator.userAgent
  );

}


function isIOSDevice() {

  return /iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );

}


function isMobileDevice() {

  return (
    isAndroidDevice() ||
    isIOSDevice() ||
    /Mobile/i.test(
      navigator.userAgent
    )
  );

}


/* =========================================================
   PDF VIEWER DEVICE MODE
   ========================================================= */

function applyPdfViewerDeviceMode() {

  const viewer =
    $("mobilePdfViewer");


  if (!viewer) {
    return;
  }


  if (
    isAndroidDevice()
  ) {

    viewer.classList.add(
      "android-pdf-viewer"
    );

  } else {

    viewer.classList.remove(
      "android-pdf-viewer"
    );

  }


  if (
    isMobileDevice()
  ) {

    viewer.classList.add(
      "mobile-device-pdf"
    );

  } else {

    viewer.classList.remove(
      "mobile-device-pdf"
    );

  }

}


/* =========================================================
   PDF VIEWER AFTER EXAM SCREEN
   ========================================================= */

function finalizePdfViewerSetup() {

  setupExamPdf();

  bindPdfFrameEvents();

  applyPdfViewerDeviceMode();

}


/* =========================================================
   SCREEN CHANGE OBSERVER
   ========================================================= */

const examScreenElement =
  $("examScreen");


if (examScreenElement) {

  const examObserver =
    new MutationObserver(
      () => {

        if (
          !examScreenElement.classList.contains(
            "hidden"
          )
        ) {

          setTimeout(
            () => {

              finalizePdfViewerSetup();

            },
            50
          );

        }

      }
    );


  examObserver.observe(
    examScreenElement,
    {
      attributes:
        true,

      attributeFilter:
        ["class"]
    }
  );

}


/* =========================================================
   INITIAL PAGE SETUP
   ========================================================= */

function initializeApplication() {

  /*
    Create option settings.
  */

  renderOptionSettings();


  /*
    Make sure the application starts
    from Home.
  */

  const screens =
    document.querySelectorAll(
      ".screen"
    );


  const visibleScreen =
    Array
      .from(screens)
      .find(
        (screen) =>
          !screen.classList.contains(
            "hidden"
          )
      );


  if (!visibleScreen) {

    showScreen(
      "homeScreen"
    );

  }


  /*
    Prepare the PDF viewer structure
    without loading any PDF yet.
  */

  setupExamPdf();

}


/* =========================================================
   DOM READY
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
  );

} else {

  initializeApplication();

}


/* =========================================================
   GLOBAL ERROR HANDLING
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


window.addEventListener(
  "error",
  (event) => {

    console.error(
      "Global JavaScript error:",
      event.error ||
        event.message
    );

  }
);


/* =========================================================
   END OF PART 3
   ========================================================= */
  /* =========================================================
   EXAM OMR — PART 4
   ========================================================= */


/* =========================================================
   PDF VIEWER EXTRA SAFETY
   ========================================================= */

/*
  The PDF.js viewer is intentionally isolated
  inside its iframe.

  We do not try to manipulate its internal buttons
  from the parent page.

  This avoids cross-origin problems and lets the
  official PDF.js viewer handle:

  - Zoom
  - Page navigation
  - Search
  - Rotation
  - Mobile touch
  - Page thumbnails
*/


function getPdfFrame() {

  return $("pdfViewerFrame");

}


/* =========================================================
   RELOAD CURRENT PDF
   ========================================================= */

function reloadCurrentPdf() {

  if (!currentPdfUrl) {

    return;

  }


  const frame =
    getPdfFrame();


  if (!frame) {

    return;

  }


  const newUrl =
    buildPdfViewerUrl(
      currentPdfUrl
    );


  frame.src =
    newUrl;


  frame.dataset.pdfUrl =
    currentPdfUrl;

}


/* =========================================================
   OPEN PDF VIEWER
   ========================================================= */

function openCurrentPdfViewer() {

  if (!currentPdfUrl) {

    alert(
      "Question paper PDF is not available."
    );

    return;

  }


  const viewerUrl =
    buildPdfViewerUrl(
      currentPdfUrl
    );


  /*
    Try opening the official PDF.js viewer.

    If popup blocking prevents this,
    fall back to the PDF URL.
  */

  const opened =
    window.open(
      viewerUrl,
      "_blank"
    );


  if (!opened) {

    window.location.href =
      viewerUrl;

  }

}


/* =========================================================
   PDF VIEWER BUTTON
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const target =
      event.target;


    if (
      !(target instanceof
        HTMLElement)
    ) {

      return;

    }


    if (
      target.closest(
        "#pdfFullscreenBtn"
      )
    ) {

      event.preventDefault();

      openCurrentPdfViewer();

    }

  }
);


/* =========================================================
   PDF EXTERNAL LINK
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const target =
      event.target;


    if (
      !(target instanceof
        HTMLElement)
    ) {

      return;

    }


    const link =
      target.closest(
        "#pdfExternalLink"
      );


    if (!link) {
      return;
    }


    if (!currentPdfUrl) {

      event.preventDefault();

      alert(
        "Question paper PDF is not available."
      );

      return;

    }


    link.href =
      currentPdfUrl;

  }
);


/* =========================================================
   PDF VIEWER KEYBOARD SUPPORT
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    /*
      Do not interfere with typing
      inside input fields.
    */

    const active =
      document.activeElement;


    if (
      active &&
      (
        active.tagName ===
          "INPUT" ||
        active.tagName ===
          "TEXTAREA" ||
        active.tagName ===
          "SELECT"
      )
    ) {

      return;

    }


    const examScreen =
      $("examScreen");


    if (
      !examScreen ||
      examScreen.classList.contains(
        "hidden"
      )
    ) {

      return;

    }


    /*
      Keyboard shortcuts for opening
      the PDF viewer.
    */

    if (
      event.key ===
      "p"
    ) {

      event.preventDefault();

      openCurrentPdfViewer();

    }

  }
);


/* =========================================================
   PDF URL VALIDATION
   ========================================================= */

function isValidPdfUrl(
  url
) {

  if (!url) {

    return false;

  }


  try {

    const parsed =
      new URL(
        url,
        window.location.href
      );


    return (
      parsed.protocol ===
        "http:" ||
      parsed.protocol ===
        "https:"
    );

  } catch {

    return false;

  }

}


/* =========================================================
   SAFE PDF INITIALIZATION
   ========================================================= */

async function safelyInitializePdf(
  url
) {

  if (
    !isValidPdfUrl(
      url
    )
  ) {

    throw new Error(
      "The question paper URL is invalid."
    );

  }


  currentPdfUrl =
    url;


  /*
    Make sure the viewer exists.
  */

  setupExamPdf();


  /*
    Give the DOM a moment to finish
    inserting the viewer.
  */

  await new Promise(
    (resolve) => {

      requestAnimationFrame(
        resolve
      );

    }
  );


  loadPdfIntoViewer(
    url
  );


  /*
    Do not attempt to inspect
    the iframe contents.

    The official viewer controls
    everything internally.
  */

}


/* =========================================================
   IMPROVED OPEN EXAM
   ========================================================= */

async function openExam(
  test
) {

  if (!test) {

    throw new Error(
      "Test data is missing."
    );

  }


  currentTest =
    test;


  currentQuestionCount =
    Number(
      test.question_count
    ) || 0;


  if (
    currentQuestionCount <=
    0
  ) {

    throw new Error(
      "Invalid question count."
    );

  }


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


  candidateName =
    "";


  /*
    Exam heading.
  */

  if ($("examName")) {

    $("examName")
      .textContent =
      test.name ||
      "Exam";

  }


  if ($("examInfo")) {

    $("examInfo")
      .textContent =
      `${currentQuestionCount} Questions • Code: ${test.code}`;

  }


  /*
    Candidate name.
  */

  ensureCandidateNameInput();


  if ($("candidateName")) {

    $("candidateName")
      .value =
      "";

  }


  /*
    PDF.
  */

  currentPdfUrl =
    test.pdf_url;


  await safelyInitializePdf(
    currentPdfUrl
  );


  /*
    OMR.
  */

  renderExam();


  /*
    Finally show exam.
  */

  showScreen(
    "examScreen"
  );


  /*
    PDF viewer may have been created
    before the screen became visible.

    Re-apply setup after screen display.
  */

  requestAnimationFrame(
    () => {

      finalizePdfViewerSetup();

    }
  );

}


/* =========================================================
   JOIN BUTTON — FINAL
   ========================================================= */

/*
  Remove any accidental duplicate join
  handlers by using a delegated handler.

  The existing listener still works, but this
  function provides a safe alternative when
  the button is clicked.
*/


async function handleJoinTest() {

  const input =
    $("joinCode");


  const status =
    $("joinStatus");


  const code =
    input?.value
      ?.trim()
      ?.toUpperCase();


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


  if (
    code.length !==
    6
  ) {

    showStatus(
      status,
      "Test Code must contain 6 characters.",
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


    await openExam(
      test
    );


  } catch (error) {

    console.error(
      error
    );


    showStatus(
      status,
      error?.message ||
        "Could not load the test.",
      "error"
    );


  } finally {

    setLoading(
      false
    );

  }

}


/*
  The HTML button already has a click listener
  from the previous section.

  We intentionally do not attach another
  click listener here because that could
  cause the test to load twice.
*/


/* =========================================================
   EXAM STATE CHECK
   ========================================================= */

function isExamActive() {

  const screen =
    $("examScreen");


  return Boolean(
    screen &&
    !screen.classList.contains(
      "hidden"
    ) &&
    currentTest
  );

}


/* =========================================================
   PREVENT ACCIDENTAL DOUBLE SUBMISSION
   ========================================================= */

let examSubmitting =
  false;


async function safeSubmitExam() {

  if (examSubmitting) {

    return;

  }


  examSubmitting =
    true;


  try {

    await submitExam();

  } finally {

    examSubmitting =
      false;

  }

}


/* =========================================================
   RESULT SAVE RETRY
   ========================================================= */

async function retrySaveResult(
  result
) {

  if (!result) {

    return false;

  }


  try {

    await saveExamResult(
      result
    );

    return true;

  } catch (error) {

    console.error(
      "Retry result save failed:",
      error
    );

    return false;

  }

}


/* =========================================================
   RESULT LOCAL BACKUP
   ========================================================= */

function createLocalResultBackup(
  result
) {

  if (!result) {
    return;
  }


  try {

    const key =
      `exam-result-${result.testCode}`;


    localStorage.setItem(
      key,
      JSON.stringify(
        result
      )
    );

  } catch (error) {

    console.warn(
      "Could not save local result backup:",
      error
    );

  }

}


/* =========================================================
   REMOVE LOCAL RESULT BACKUP
   ========================================================= */

function removeLocalResultBackup(
  testCode
) {

  if (!testCode) {
    return;
  }


  try {

    localStorage.removeItem(
      `exam-result-${testCode}`
    );

  } catch (error) {

    console.warn(
      "Could not remove local result backup:",
      error
    );

  }

}


/* =========================================================
   RESULT DISPLAY AFTER SUBMISSION
   ========================================================= */

function finishExamWithResult(
  result,
  saved
) {

  renderResult(
    result
  );


  if (saved) {

    removeLocalResultBackup(
      result.testCode
    );

  } else {

    createLocalResultBackup(
      result
    );

  }


  /*
    Scroll to result.
  */

  const resultBox =
    $("resultBox");


  if (resultBox) {

    setTimeout(
      () => {

        resultBox.scrollIntoView({
          behavior:
            "smooth",

          block:
            "center"
        });

      },
      100
    );

  }

}


/* =========================================================
   RESULT STATUS
   ========================================================= */

function showResultSaveStatus(
  saved
) {

  const box =
    $("resultBox");


  if (!box) {
    return;
  }


  const existing =
    box.querySelector(
      ".result-save-status"
    );


  if (existing) {

    existing.remove();

  }


  const status =
    document.createElement(
      "div"
    );


  status.className =
    "result-save-status";


  if (saved) {

    status.textContent =
      "✓ Result saved successfully.";

    status.classList.add(
      "success"
    );

  } else {

    status.textContent =
      "⚠ Result calculated locally. Online save failed.";

    status.classList.add(
      "warning"
    );

  }


  box.appendChild(
    status
  );

}


/* =========================================================
   FINAL SUBMIT FLOW
   ========================================================= */

async function submitExamFinal() {

  if (!isExamActive()) {

    return;

  }


  const nameInput =
    $("candidateName");


  candidateName =
    nameInput?.value
      ?.trim() ||
    "";


  if (!candidateName) {

    alert(
      "Please enter your name before submitting the exam."
    );


    nameInput?.focus();


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

    const confirmed =
      confirm(
        `${unanswered} question(s) are unanswered.\n\nDo you want to submit the exam?`
      );


    if (!confirmed) {

      return;

    }

  }


  const result =
    calculateResult();


  setLoading(
    true,
    "Saving your result..."
  );


  let saved =
    false;


  try {

    await saveExamResult(
      result
    );


    saved =
      true;


  } catch (error) {

    console.error(
      "Could not save result:",
      error
    );


    /*
      We don't throw the result away.

      The candidate still gets the
      calculated result.
    */

    createLocalResultBackup(
      result
    );

  }


  setLoading(
    false
  );


  finishExamWithResult(
    result,
    saved
  );


  showResultSaveStatus(
    saved
  );

}


/* =========================================================
   SUBMIT BUTTON REPLACEMENT
   ========================================================= */

/*
  Replace the previous handler by using
  event delegation.

  This works even if the button is recreated
  by another UI layer.
*/

document.addEventListener(
  "click",
  (event) => {

    const target =
      event.target;


    if (
      !(target instanceof
        HTMLElement)
    ) {

      return;

    }


    if (
      target.closest(
        "#submitExamBtn"
      )
    ) {

      /*
        Stop the event from bubbling
        further.
      */

      event.preventDefault();


      /*
        Use the final submit flow.
      */

      submitExamFinal();

    }

  }
);


/* =========================================================
   CREATE SCREEN SHORTCUT
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    const createScreen =
      $("createScreen");


    if (
      createScreen &&
      !createScreen.classList.contains(
        "hidden"
      )
    ) {

      showScreen(
        "homeScreen"
      );

    }

  }
);


/* =========================================================
   EXAM PDF URL CHANGE DETECTION
   ========================================================= */

let previousExamPdfUrl =
  "";


function detectPdfUrlChange() {

  if (
    !currentTest
  ) {

    return;

  }


  const url =
    currentTest.pdf_url;


  if (
    !url
  ) {

    return;

  }


  if (
    url ===
    previousExamPdfUrl
  ) {

    return;

  }


  previousExamPdfUrl =
    url;


  currentPdfUrl =
    url;


  const frame =
    $("pdfViewerFrame");


  if (
    frame &&
    frame.dataset.pdfUrl !==
      url
  ) {

    loadPdfIntoViewer(
      url
    );

  }

}


/* =========================================================
   PDF VIEWER WATCHER
   ========================================================= */

setInterval(
  () => {

    if (
      !isExamActive()
    ) {

      return;

    }


    detectPdfUrlChange();

  },
  1000
);


/* =========================================================
   END OF PART 4
   ========================================================= */
   /* =========================================================
   EXAM OMR — PART 5/5
   FINAL INITIALIZATION & NAVIGATION
   ========================================================= */


/* =========================================================
   BACK TO HOME
   ========================================================= */

function goHome() {

  /*
    Clean PDF viewer first.
  */

  destroyPdfViewer();


  /*
    Reset exam state.
  */

  currentTest =
    null;

  currentPdfUrl =
    "";

  currentQuestionCount =
    40;

  currentOptions =
    [];

  currentAnswerKey =
    [];

  selectedAnswers =
    [];

  candidateName =
    "";

  previousExamPdfUrl =
    "";


  /*
    Show home.
  */

  showScreen(
    "homeScreen"
  );

}


/* =========================================================
   HOME BUTTONS
   ========================================================= */

$("backHomeFromCreate")
  ?.addEventListener(
    "click",
    () => {

      goHome();

    }
  );


$("backHomeFromJoin")
  ?.addEventListener(
    "click",
    () => {

      goHome();

    }
  );


$("goHomeAfterCreate")
  ?.addEventListener(
    "click",
    () => {

      goHome();

    }
  );


/* =========================================================
   CREATE TEST SCREEN
   ========================================================= */

function openCreateScreen() {

  showScreen(
    "createScreen"
  );


  renderOptionSettings();

}


$("showCreateBtn")
  ?.addEventListener(
    "click",
    openCreateScreen
  );


/* =========================================================
   JOIN SCREEN
   ========================================================= */

function openJoinScreen() {

  showScreen(
    "joinScreen"
  );


  const input =
    $("joinCode");


  setTimeout(
    () => {

      input?.focus();

    },
    100
  );

}


$("showJoinBtn")
  ?.addEventListener(
    "click",
    openJoinScreen
  );


/* =========================================================
   BACK TO CREATE FROM ANSWER KEY
   ========================================================= */

$("backToCreateBtn")
  ?.addEventListener(
    "click",
    () => {

      showScreen(
        "createScreen"
      );

    }
  );


/* =========================================================
   CREATE SCREEN — QUESTION COUNT
   ========================================================= */

$("questionCount")
  ?.addEventListener(
    "input",
    () => {

      const input =
        $("questionCount");


      if (!input) {
        return;
      }


      let value =
        Number(
          input.value
        );


      if (
        !Number.isFinite(
          value
        )
      ) {

        value =
          40;

      }


      value =
        Math.max(
          1,
          Math.min(
            300,
            Math.floor(
              value
            )
          )
        );


      /*
        Don't force the value back
        while the user is typing an
        empty field.
      */

      if (
        input.value !==
        ""
      ) {

        input.value =
          String(value);

      }


      renderOptionSettings();

    }
  );


/* =========================================================
   DEFAULT OPTION CHANGE
   ========================================================= */

$("defaultOptions")
  ?.addEventListener(
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
   JOIN CODE FORMATTER
   ========================================================= */

$("joinCode")
  ?.addEventListener(
    "input",
    (event) => {

      const input =
        event.target;


      input.value =
        input.value
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
   JOIN CODE ENTER
   ========================================================= */

$("joinCode")
  ?.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !==
        "Enter"
      ) {

        return;

      }


      event.preventDefault();


      $("joinBtn")
        ?.click();

    }
  );


/* =========================================================
   CANDIDATE NAME
   ========================================================= */

document.addEventListener(
  "input",
  (event) => {

    const target =
      event.target;


    if (
      !(target instanceof
        HTMLInputElement)
    ) {

      return;

    }


    if (
      target.id !==
      "candidateName"
    ) {

      return;

    }


    /*
      Keep candidate name trimmed
      when calculating result, but
      don't alter what the user types.
    */

    candidateName =
      target.value.trim();

  }
);


/* =========================================================
   CANDIDATE NAME ENTER
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    const target =
      event.target;


    if (
      !(target instanceof
        HTMLInputElement)
    ) {

      return;

    }


    if (
      target.id !==
      "candidateName"
    ) {

      return;

    }


    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();


      submitExamFinal();

    }

  }
);


/* =========================================================
   PDF VIEWER RESPONSIVE MODE
   ========================================================= */

function updatePdfViewerLayout() {

  const viewer =
    $("mobilePdfViewer");


  if (!viewer) {
    return;
  }


  const frame =
    $("pdfViewerFrame");


  if (!frame) {
    return;
  }


  /*
    Mobile browsers sometimes report
    a very small iframe height before
    layout is complete.

    Give it a sensible minimum.
  */

  if (
    window.innerWidth <=
    650
  ) {

    frame.style.minHeight =
      "520px";

  } else {

    frame.style.minHeight =
      "700px";

  }

}


window.addEventListener(
  "resize",
  () => {

    updatePdfViewerLayout();

  }
);


/* =========================================================
   PDF VIEWER SCREEN CHANGE
   ========================================================= */

function preparePdfViewerWhenVisible() {

  const examScreen =
    $("examScreen");


  if (!examScreen) {
    return;
  }


  if (
    examScreen.classList.contains(
      "hidden"
    )
  ) {

    return;

  }


  setupExamPdf();

  bindPdfFrameEvents();

  applyPdfViewerDeviceMode();

  updatePdfViewerLayout();


  /*
    If PDF URL exists but the iframe
    has not been loaded yet, load it.
  */

  if (
    currentPdfUrl
  ) {

    const frame =
      $("pdfViewerFrame");


    if (
      frame &&
      frame.dataset.pdfUrl !==
        currentPdfUrl
    ) {

      loadPdfIntoViewer(
        currentPdfUrl
      );

    }

  }

}


/* =========================================================
   EXAM SCREEN OBSERVER
   ========================================================= */

const examScreen =
  $("examScreen");


if (examScreen) {

  const observer =
    new MutationObserver(
      () => {

        preparePdfViewerWhenVisible();

      }
    );


  observer.observe(
    examScreen,
    {
      attributes:
        true,

      attributeFilter:
        [
          "class"
        ]
    }
  );

}


/* =========================================================
   APPLICATION INITIALIZATION
   ========================================================= */

function initializeApplication() {

  /*
    Create default option settings.
  */

  renderOptionSettings();


  /*
    Prepare PDF viewer structure.
  */

  setupExamPdf();


  /*
    Apply device-specific viewer
    classes.
  */

  applyPdfViewerDeviceMode();


  /*
    Responsive PDF layout.
  */

  updatePdfViewerLayout();


  /*
    Find visible screen.
  */

  const screens =
    document.querySelectorAll(
      ".screen"
    );


  const visible =
    Array
      .from(screens)
      .find(
        (screen) =>
          !screen.classList.contains(
            "hidden"
          )
      );


  /*
    If nothing is visible,
    show Home.
  */

  if (!visible) {

    showScreen(
      "homeScreen"
    );

  }


  /*
    Otherwise keep current screen.
  */

}


/* =========================================================
   DOM READY
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
  );

} else {

  initializeApplication();

}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {

    console.error(
      "Exam OMR error:",
      event.error ||
        event.message
    );

  }
);


window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "Exam OMR promise error:",
      event.reason
    );

  }
);


/* =========================================================
   NETWORK STATUS
   ========================================================= */

window.addEventListener(
  "online",
  () => {

    console.log(
      "Internet connection restored."
    );

  }
);


window.addEventListener(
  "offline",
  () => {

    console.warn(
      "Internet connection lost."
    );

  }
);


/* =========================================================
   FINAL SAFETY CHECK
   ========================================================= */

console.log(
  "Exam OMR initialized successfully."
);


/* =========================================================
   END OF script.js
   ========================================================= */
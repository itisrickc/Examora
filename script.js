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

const RESULTS_TABLE =
  "results";

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

let candidateName = "";

let resultSaved = false;

let submissionInProgress = false;


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
  const screens =
    document.querySelectorAll(
      ".screen"
    );

  screens.forEach((screen) => {
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
   UTILITY HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatNumber(number) {
  const value =
    Number(number);

  if (!Number.isFinite(value)) {
    return "0";
  }

  return value
    .toFixed(2)
    .replace(/\.00$/, "");
}


function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
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
        MAX_QUESTIONS,
        Number(
          $("questionCount")?.value
        ) || 40
      )
    );

  const defaultOptionCount =
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
      <option value="4">4 Options</option>
      <option value="2">2 Options</option>
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

  return Array.from(
    selects
  ).map((select) =>
    normalizeOptionCount(
      select.value
    )
  );
}


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
          cacheControl: "3600",
          upsert: false,
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
   PDF MOBILE SUPPORT
   ========================================================= */

function openQuestionPaper() {
  if (!currentPdfUrl) {
    alert(
      "Question paper is not available."
    );

    return;
  }

  window.open(
    currentPdfUrl,
    "_blank",
    "noopener,noreferrer"
  );
}


function setupPdfViewer() {
  const iframe =
    $("examPdf");

  if (!iframe) {
    return;
  }

  iframe.src =
    currentPdfUrl;

  iframe.setAttribute(
    "loading",
    "lazy"
  );

  const parent =
    iframe.parentElement;

  if (!parent) {
    return;
  }

  let fallback =
    document.getElementById(
      "pdfMobileFallback"
    );

  if (!fallback) {
    fallback =
      document.createElement(
        "div"
      );

    fallback.id =
      "pdfMobileFallback";

    fallback.className =
      "pdf-mobile-fallback";

    fallback.innerHTML = `
      <div class="pdf-fallback-icon">
        PDF
      </div>

      <strong>
        Question Paper
      </strong>

      <span>
        Your browser may not display PDFs inside the page.
        Open the question paper separately.
      </span>

      <button
        id="openPdfMobileBtn"
        class="primary-btn"
        type="button"
      >
        Open Question Paper
      </button>
    `;

    parent.appendChild(
      fallback
    );

    const openButton =
      document.getElementById(
        "openPdfMobileBtn"
      );

    if (openButton) {
      openButton.addEventListener(
        "click",
        openQuestionPaper
      );
    }
  }

  /*
   * Android browsers are not always able to render
   * PDF files inside an iframe.
   *
   * The iframe remains available on desktop.
   * Mobile users receive a reliable Open PDF button.
   */

  const isMobile =
    window.matchMedia(
      "(max-width: 700px)"
    ).matches;

  if (isMobile) {
    iframe.style.display =
      "none";

    fallback.style.display =
      "flex";
  } else {
    iframe.style.display =
      "block";

    fallback.style.display =
      "none";
  }
}


window.addEventListener(
  "resize",
  setupPdfViewer
);


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

  renderQuickAnswerKeyInput();
}


/* =========================================================
   QUICK ANSWER KEY
   ========================================================= */

function renderQuickAnswerKeyInput() {
  const screen =
    $("answerKeyScreen");

  if (!screen) {
    return;
  }

  if (
    document.getElementById(
      "quickAnswerKeyBox"
    )
  ) {
    return;
  }

  const card =
    document.createElement(
      "div"
    );

  card.id =
    "quickAnswerKeyBox";

  card.className =
    "card";

  card.style.marginTop =
    "16px";

  card.innerHTML = `
    <h3>
      Quick Answer Key
    </h3>

    <p>
      Enter answers in order.
      Example: A B C D A B
    </p>

    <input
      id="quickAnswerKey"
      type="text"
      placeholder="A B C D A B C..."
      autocomplete="off"
    >

    <div
      id="quickAnswerKeyStatus"
      class="status-box hidden"
    ></div>

    <div class="actions">
      <button
        id="applyQuickAnswerKeyBtn"
        class="primary-btn"
        type="button"
      >
        Apply Answer Key
      </button>

      <button
        id="clearQuickAnswerKeyBtn"
        class="secondary-btn"
        type="button"
      >
        Clear
      </button>
    </div>
  `;

  const answerGrid =
    $("answerKeyGrid");

  if (
    answerGrid &&
    answerGrid.parentElement
  ) {
    answerGrid.parentElement.insertBefore(
      card,
      answerGrid
    );
  } else {
    screen
      .querySelector(".card")
      ?.appendChild(card);
  }

  const applyButton =
    document.getElementById(
      "applyQuickAnswerKeyBtn"
    );

  const clearButton =
    document.getElementById(
      "clearQuickAnswerKeyBtn"
    );

  if (applyButton) {
    applyButton.addEventListener(
      "click",
      applyQuickAnswerKey
    );
  }

  if (clearButton) {
    clearButton.addEventListener(
      "click",
      () => {
        const input =
          $("quickAnswerKey");

        if (input) {
          input.value =
            "";
        }

        const status =
          $("quickAnswerKeyStatus");

        hideStatus(status);
      }
    );
  }
}


function parseAnswerKeyText(
  text
) {
  return text
    .toUpperCase()
    .replace(/[,|;]+/g, " ")
    .split(/\s+/)
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}


function applyQuickAnswerKey() {
  const input =
    $("quickAnswerKey");

  const status =
    $("quickAnswerKeyStatus");

  if (!input) {
    return;
  }

  const answers =
    parseAnswerKeyText(
      input.value
    );

  if (
    answers.length !==
    currentQuestionCount
  ) {
    showStatus(
      status,
      `Please enter exactly ${currentQuestionCount} answers. You entered ${answers.length}.`,
      "error"
    );

    return;
  }

  for (
    let i = 0;
    i < answers.length;
    i++
  ) {
    const allowed =
      getOptionLabels(
        currentOptions[i] || 4
      );

    if (
      !allowed.includes(
        answers[i]
      )
    ) {
      showStatus(
        status,
        `Invalid answer "${answers[i]}" for Question ${i + 1}.`,
        "error"
      );

      return;
    }
  }

  currentAnswerKey =
    answers.slice();

  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  selects.forEach(
    (select, index) => {
      select.value =
        currentAnswerKey[index] ||
        "";
    }
  );

  showStatus(
    status,
    "Answer key applied successfully.",
    "success"
  );
}


function collectAnswerKey() {
  const selects =
    document.querySelectorAll(
      ".answer-key-select"
    );

  return Array.from(
    selects
  ).map(
    (select) =>
      select.value
  );
}


/* =========================================================
   CREATE TEST
   ========================================================= */

async function handleGenerateTest() {
  const name =
    $("testName")?.value.trim();

  const pdfFile =
    $("pdfFile")?.files[0];

  const questionCount =
    Number(
      $("questionCount")?.value
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
    questionCount >
      MAX_QUESTIONS
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
    console.error(error);

    alert(
      "Could not prepare the test.\n\n" +
      error.message
    );

  } finally {
    setLoading(false);
  }
}


/* =========================================================
   SAVE TEST
   ========================================================= */

async function handleSaveTest() {
  if (!currentTest) {
    alert(
      "No test is ready to save."
    );

    return;
  }

  let answerKey =
    collectAnswerKey();

  const quickInput =
    $("quickAnswerKey");

  if (
    answerKey.every(
      (answer) => !answer
    ) &&
    quickInput &&
    quickInput.value.trim()
  ) {
    applyQuickAnswerKey();

    answerKey =
      collectAnswerKey();
  }

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
    Number(
      $("correctMark")?.value
    );

  const wrongMark =
    Number(
      $("wrongMark")?.value
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
   JOIN TEST
   ========================================================= */

async function handleJoinTest() {
  const code =
    $("joinCode")
      ?.value
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

    resultSaved =
      false;

    submissionInProgress =
      false;

    candidateName =
      "";

    $("examName").textContent =
      test.name;

    $("examInfo").textContent =
      `${currentQuestionCount} Questions • Code: ${test.code}`;

    currentPdfUrl =
      test.pdf_url || "";

    renderCandidateSection();

    renderExam();

    setupPdfViewer();

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


/* =========================================================
   CANDIDATE SECTION
   ========================================================= */

function renderCandidateSection() {
  const examScreen =
    $("examScreen");

  if (!examScreen) {
    return;
  }

  let card =
    document.getElementById(
      "candidateCard"
    );

  if (!card) {
    card =
      document.createElement(
        "div"
      );

    card.id =
      "candidateCard";

    card.className =
      "card candidate-card";

    const workspace =
      examScreen.querySelector(
        ".exam-workspace"
      );

    if (workspace) {
      examScreen.insertBefore(
        card,
        workspace
      );
    } else {
      examScreen.appendChild(
        card
      );
    }
  }

  card.innerHTML = `
    <div>
      <h3>
        Candidate Information
      </h3>

      <p>
        Enter your name before submitting the examination.
      </p>
    </div>

    <div class="candidate-input-row">

      <input
        id="candidateNameInput"
        type="text"
        maxlength="100"
        placeholder="Enter your full name"
        autocomplete="name"
      >

      <button
        id="saveCandidateNameBtn"
        class="secondary-btn"
        type="button"
      >
        Save Name
      </button>

    </div>

    <div
      id="candidateStatus"
      class="status-box hidden"
    ></div>
  `;

  const saveButton =
    $("saveCandidateNameBtn");

  if (saveButton) {
    saveButton.addEventListener(
      "click",
      saveCandidateName
    );
  }

  const input =
    $("candidateNameInput");

  if (input) {
    input.value =
      candidateName;
  }
}


function saveCandidateName() {
  const input =
    $("candidateNameInput");

  const status =
    $("candidateStatus");

  if (!input) {
    return;
  }

  const name =
    input.value.trim();

  if (!name) {
    showStatus(
      status,
      "Please enter your name.",
      "error"
    );

    return;
  }

  if (name.length < 2) {
    showStatus(
      status,
      "Please enter a valid name.",
      "error"
    );

    return;
  }

  candidateName =
    name;

  showStatus(
    status,
    `Name saved: ${candidateName}`,
    "success"
  );
}


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

      label.appendChild(
        input
      );

      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        labels[j];

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
   RESET EXAM
   ========================================================= */

function resetExamAnswers() {
  const proceed =
    confirm(
      "Are you sure you want to delete all selected answers?"
    );

  if (!proceed) {
    return;
  }

  selectedAnswers =
    new Array(
      currentQuestionCount
    ).fill("");

  const inputs =
    document.querySelectorAll(
      ".answer-option input"
    );

  inputs.forEach(
    (input) => {
      input.checked =
        false;
    }
  );

  const labels =
    document.querySelectorAll(
      ".answer-option"
    );

  labels.forEach(
    (label) => {
      label.classList.remove(
        "selected"
      );
    }
  );

  resultSaved =
    false;

  submissionInProgress =
    false;

  const resultBox =
    $("resultBox");

  if (resultBox) {
    hide(resultBox);
    resultBox.innerHTML =
      "";
  }

  updateProgress();
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

async function handleSubmitExam() {
  if (!currentTest) {
    return;
  }

  if (resultSaved) {
    alert(
      "This examination has already been submitted."
    );

    return;
  }

  if (submissionInProgress) {
    return;
  }

  if (!candidateName) {
    saveCandidateName();

    if (!candidateName) {
      return;
    }
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

  const confirmed =
    confirm(
      "Are you sure you want to submit the examination?"
    );

  if (!confirmed) {
    return;
  }

  submissionInProgress =
    true;

  setLoading(
    true,
    "Checking your answers..."
  );

  try {
    const result =
      calculateResult();

    setLoading(
      true,
      "Saving your result..."
    );

    await saveResult(
      result
    );

    resultSaved =
      true;

    renderResult(
      result
    );

    const submitButton =
      $("submitExamBtn");

    if (submitButton) {
      submitButton.disabled =
        true;

      submitButton.textContent =
        "Submitted";
    }

  } catch (error) {
    console.error(error);

    alert(
      "Could not submit the examination.\n\n" +
      error.message
    );

  } finally {
    submissionInProgress =
      false;

    setLoading(false);
  }
}


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

  const percentage =
    totalMarks > 0
      ? (
          score /
          totalMarks
        ) *
        100
      : 0;

  return {
    correct,
    wrong,
    unanswered,
    score,
    totalMarks,
    percentage
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
      "No active test."
    );
  }

  const payload = {
    test_code:
      currentTest.code,

    candidate_name:
      candidateName,

    answers:
      selectedAnswers,

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
      result.percentage
  };

  const {
    error
  } =
    await supabaseClient
      .from(RESULTS_TABLE)
      .insert(payload);

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
        <span>Percentage</span>
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
        ${formatNumber(result.score)}
        /
        ${formatNumber(result.totalMarks)}
      </strong>

    </div>

    <div
      style="
        margin-top: 14px;
        color: var(--success);
        font-size: 13px;
        font-weight: 800;
      "
    >
      Result saved successfully.
    </div>
  `;

  show(resultBox);

  resultBox.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* =========================================================
   RESULT CHECK SYSTEM
   ========================================================= */

function createResultCheckScreen() {
  if (
    document.getElementById(
      "resultCheckScreen"
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      "main.container"
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      "section"
    );

  section.id =
    "resultCheckScreen";

  section.className =
    "screen hidden";

  section.innerHTML = `
    <div class="card result-check-card">

      <button
        id="backHomeFromResults"
        class="small-btn secondary-btn"
        type="button"
      >
        ← Back
      </button>

      <h2 style="margin-top: 28px;">
        Check Results
      </h2>

      <p>
        Enter the same Test Code to view
        the results of everyone who submitted
        this examination.
      </p>

      <label>
        Test Code
      </label>

      <input
        id="resultCheckCode"
        type="text"
        maxlength="6"
        placeholder="E.g. A7K92P"
        autocomplete="off"
      >

      <button
        id="checkResultsBtn"
        class="primary-btn full-btn"
        type="button"
        style="margin-top: 12px;"
      >
        Check Results
      </button>

      <div
        id="resultCheckStatus"
        class="status-box hidden"
      ></div>

    </div>

    <div
      id="resultsSummaryCard"
      class="card result-summary-card hidden"
    >
    </div>
  `;

  main.appendChild(
    section
  );

  $("backHomeFromResults")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );

  $("checkResultsBtn")
    ?.addEventListener(
      "click",
      handleCheckResults
    );

  $("resultCheckCode")
    ?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Enter"
        ) {
          handleCheckResults();
        }
      }
    );
}


async function handleCheckResults() {
  const input =
    $("resultCheckCode");

  const status =
    $("resultCheckStatus");

  const summary =
    $("resultsSummaryCard");

  if (!input) {
    return;
  }

  const code =
    input.value
      .trim()
      .toUpperCase();

  hideStatus(status);

  if (summary) {
    hide(summary);
  }

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
    const test =
      await loadTestByCode(
        code
      );

    const {
      data,
      error
    } =
      await supabaseClient
        .from(RESULTS_TABLE)
        .select("*")
        .eq(
          "test_code",
          code
        )
        .order(
          "percentage",
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    renderAllResults(
      test,
      data || []
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


/* =========================================================
   RENDER ALL RESULTS
   ========================================================= */

function renderAllResults(
  test,
  results
) {
  const summary =
    $("resultsSummaryCard");

  if (!summary) {
    return;
  }

  if (
    !results ||
    results.length === 0
  ) {
    summary.innerHTML = `
      <div class="result-summary-header">
        <h2>
          ${escapeHtml(
            test.name
          )}
        </h2>

        <p>
          No candidate has submitted this test yet.
        </p>
      </div>
    `;

    show(summary);

    return;
  }

  const rows =
    results
      .map(
        (result, index) => `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  result.candidate_name
                )}
              </strong>
            </td>

            <td>
              ${result.correct_count ?? 0}
            </td>

            <td>
              ${result.wrong_count ?? 0}
            </td>

            <td>
              ${result.unanswered_count ?? 0}
            </td>

            <td>
              ${formatNumber(
                result.score
              )}
              /
              ${formatNumber(
                result.total_marks
              )}
            </td>

            <td>
              ${Number(
                result.percentage || 0
              ).toFixed(2)}%
            </td>

            <td>
              ${formatDate(
                result.submitted_at
              )}
            </td>

          </tr>
        `
      )
      .join("");

  const mobileCards =
    results
      .map(
        (result, index) => `
          <div class="mobile-result-card">

            <div class="mobile-result-header">

              <div class="mobile-result-name">
                ${escapeHtml(
                  result.candidate_name
                )}
              </div>

              <div class="mobile-result-rank">
                #${index + 1}
              </div>

            </div>

            <div class="mobile-result-grid">

              <div class="mobile-result-stat">
                <span>
                  Correct
                </span>

                <strong>
                  ${result.correct_count ?? 0}
                </strong>
              </div>

              <div class="mobile-result-stat">
                <span>
                  Wrong
                </span>

                <strong>
                  ${result.wrong_count ?? 0}
                </strong>
              </div>

              <div class="mobile-result-stat">
                <span>
                  Unanswered
                </span>

                <strong>
                  ${result.unanswered_count ?? 0}
                </strong>
              </div>

              <div class="mobile-result-stat">
                <span>
                  Percentage
                </span>

                <strong>
                  ${Number(
                    result.percentage || 0
                  ).toFixed(2)}%
                </strong>
              </div>

              <div class="mobile-result-stat">
                <span>
                  Score
                </span>

                <strong>
                  ${formatNumber(
                    result.score
                  )}
                  /
                  ${formatNumber(
                    result.total_marks
                  )}
                </strong>
              </div>

              <div class="mobile-result-stat">
                <span>
                  Submitted
                </span>

                <strong
                  style="
                    font-size: 12px;
                  "
                >
                  ${formatDate(
                    result.submitted_at
                  )}
                </strong>
              </div>

            </div>

          </div>
        `
      )
      .join("");

  summary.innerHTML = `
    <div class="result-summary-header">

      <div
        style="
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        "
      >

        <div>

          <div class="eyebrow">
            TEST RESULTS
          </div>

          <h2>
            ${escapeHtml(
              test.name
            )}
          </h2>

          <p>
            Code:
            <strong>
              ${escapeHtml(
                test.code
              )}
            </strong>
            •
            ${test.question_count}
            Questions
          </p>

        </div>

        <div
          class="progress-badge"
          style="
            font-size:13px;
          "
        >
          ${results.length}
          Candidate${results.length === 1 ? "" : "s"}
        </div>

      </div>

    </div>

    <div class="table-wrapper">

      <table class="results-table">

        <thead>

          <tr>

            <th>
              Rank
            </th>

            <th>
              Candidate
            </th>

            <th>
              Correct
            </th>

            <th>
              Wrong
            </th>

            <th>
              Unanswered
            </th>

            <th>
              Score
            </th>

            <th>
              Percentage
            </th>

            <th>
              Submitted
            </th>

          </tr>

        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

    </div>

    <div class="mobile-results-list">
      ${mobileCards}
    </div>
  `;

  show(summary);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  $("showCreateBtn")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "createScreen"
        );
      }
    );


  $("showJoinBtn")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "joinScreen"
        );
      }
    );


  $("backHomeFromCreate")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );


  $("backToCreateBtn")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "createScreen"
        );
      }
    );


  $("backHomeFromJoin")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );


  $("goHomeAfterCreate")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );


  $("exitExamBtn")
    ?.addEventListener(
      "click",
      () => {

        const proceed =
          confirm(
            "Are you sure you want to exit this examination?"
          );

        if (!proceed) {
          return;
        }

        showScreen(
          "homeScreen"
        );
      }
    );


  $("copyCodeBtn")
    ?.addEventListener(
      "click",
      copyCreatedCode
    );


  $("joinBtn")
    ?.addEventListener(
      "click",
      handleJoinTest
    );


  $("submitExamBtn")
    ?.addEventListener(
      "click",
      handleSubmitExam
    );


  $("resetExamBtn")
    ?.addEventListener(
      "click",
      resetExamAnswers
    );


  $("generateBtn")
    ?.addEventListener(
      "click",
      handleGenerateTest
    );


  $("saveTestBtn")
    ?.addEventListener(
      "click",
      handleSaveTest
    );


  $("clearCreateBtn")
    ?.addEventListener(
      "click",
      clearCreateForm
    );


  $("questionCount")
    ?.addEventListener(
      "input",
      () => {
        renderOptionSettings();
      }
    );


  $("defaultOptions")
    ?.addEventListener(
      "change",
      () => {
        renderOptionSettings();
      }
    );


  $("pdfFile")
    ?.addEventListener(
      "change",
      handlePdfSelection
    );


  $("joinCode")
    ?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Enter"
        ) {
          handleJoinTest();
        }
      }
    );
}


/* =========================================================
   PDF FILE SELECTION
   ========================================================= */

function handlePdfSelection(
  event
) {
  const file =
    event.target.files[0];

  const status =
    $("pdfStatus");

  const previewBox =
    $("pdfPreviewBox");

  const preview =
    $("pdfPreview");

  if (!status) {
    return;
  }

  if (previewBox) {
    hide(previewBox);
  }

  if (preview) {
    preview.removeAttribute(
      "src"
    );
  }

  if (!file) {
    status.textContent =
      "";

    return;
  }

  if (
    file.type !==
    "application/pdf"
  ) {
    event.target.value =
      "";

    status.textContent =
      "Please select a PDF file.";

    status.style.color =
      "#dc2626";

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

  if (previewBox) {
    show(previewBox);
  }

  status.textContent =
    `${file.name} selected.`;

  status.style.color =
    "#16a34a";
}


/* =========================================================
   COPY CODE
   ========================================================= */

async function copyCreatedCode() {
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

    alert(
      "Test Code copied successfully."
    );

  } catch (error) {
    console.error(error);

    alert(
      `Your Test Code is: ${code}`
    );
  }
}


/* =========================================================
   CLEAR CREATE FORM
   ========================================================= */

function clearCreateForm() {
  const testName =
    $("testName");

  const pdfFile =
    $("pdfFile");

  const questionCount =
    $("questionCount");

  const defaultOptions =
    $("defaultOptions");

  const pdfStatus =
    $("pdfStatus");

  const pdfPreviewBox =
    $("pdfPreviewBox");

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

  if (defaultOptions) {
    defaultOptions.value =
      "4";
  }

  if (pdfStatus) {
    pdfStatus.textContent =
      "";
  }

  if (pdfPreviewBox) {
    hide(pdfPreviewBox);
  }

  currentPdfUrl =
    "";

  currentTest =
    null;

  currentQuestionCount =
    40;

  currentOptions =
    [];

  currentAnswerKey =
    [];
}


/* =========================================================
   HOME RESULT BUTTON
   ========================================================= */

function createHomeResultButton() {
  const homeActions =
    document.querySelector(
      ".home-actions"
    );

  if (
    !homeActions ||
    document.getElementById(
      "showResultsBtn"
    )
  ) {
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.id =
    "showResultsBtn";

  button.className =
    "secondary-btn";

  button.type =
    "button";

  button.textContent =
    "Check Results";

  button.addEventListener(
    "click",
    () => {
      createResultCheckScreen();

      showScreen(
        "resultCheckScreen"
      );
    }
  );

  homeActions.appendChild(
    button
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeApp() {

  /*
   * Create dynamic result-check interface.
   */

  createResultCheckScreen();

  /*
   * Add result button to home page.
   */

  createHomeResultButton();

  /*
   * Render default question options.
   */

  renderOptionSettings();

  /*
   * Setup all existing buttons.
   */

  setupNavigation();

  /*
   * Make sure the home screen is visible.
   */

  showScreen(
    "homeScreen"
  );

  console.log(
    "Exam OMR initialized successfully."
  );
}


/* =========================================================
   START APP
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}
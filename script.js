/* =========================================================
   EXAM OMR
   FINAL JAVASCRIPT — v1.0
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

const OPTION_LABELS =
  ["A", "B", "C", "D"];

const PDFJS_VERSION =
  "4.10.38";

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

let currentPdfDocument = null;

let currentPdfPage = 1;

let currentPdfScale = 1;

let pdfRendering = false;

let pdfJsModule = null;


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

  screens.forEach(
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


/* =========================================================
   SAFE TEXT
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

    const { data, error } =
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
        300,
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

  return Array.from(
    selects
  ).map(
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
      event.target.files[0];

    const status =
      $("pdfStatus");

    const previewBox =
      $("pdfPreviewBox");

    const preview =
      $("pdfPreview");

    if (previewBox) {
      hide(previewBox);
    }

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

  const { error:
    uploadError
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

  const { data } =
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
      `<option value="">
        Select
      </option>` +
      labels
        .map(
          (label) =>
            `<option value="${label}">
              ${label}
            </option>`
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
   GENERATE TEST
   ========================================================= */

$("generateBtn")?.addEventListener(
  "click",
  async () => {

    const name =
      $("testName")?.value
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
          .insert(payload)
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

  if (!examScreen) {
    return;
  }

  const existingHeader =
    examScreen.querySelector(
      ".exam-header"
    );

  if (!existingHeader) {
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

  existingHeader
    .parentNode
    .insertBefore(
      wrapper,
      existingHeader.nextSibling
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

      currentPdfUrl =
        test.pdf_url;

      ensureCandidateNameInput();

      const candidateInput =
        $("candidateName");

      if (candidateInput) {
        candidateInput.value =
          "";
      }

      await initializePdfViewer(
        test.pdf_url
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

  const total =
    currentQuestionCount;

  const progress =
    $("questionProgress");

  if (progress) {
    progress.textContent =
      `${answered} / ${total}`;
  }

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

  const progressStrong =
    document.querySelector(
      ".omr-progress strong"
    );

  if (progressStrong) {
    progressStrong.textContent =
      `${answered}/${total}`;
  }
}


/* =========================================================
   RESET EXAM
   ========================================================= */

$("resetExamBtn")?.addEventListener(
  "click",
  () => {

    const confirmed =
      confirm(
        "Delete all selected answers?"
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
        ".answer-option input"
      );

    inputs.forEach(
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

    const resultBox =
      $("resultBox");

    if (resultBox) {
      resultBox.innerHTML =
        "";

      hide(resultBox);
    }

    updateProgress();

    const grid =
      $("examGrid");

    if (grid) {
      grid.scrollTop = 0;
    }
  }
);


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
        ?.trim() || "";

    if (!candidateName) {

      alert(
        "Please enter your name before submitting the exam."
      );

      input?.focus();

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
        error
      );

      alert(
        "Your result was calculated, but could not be saved.\n\n" +
        error.message
      );

      const result =
        calculateResult();

      renderResult(
        result
      );

    } finally {

      setLoading(
        false
      );
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

  const percentage =
    totalMarks > 0
      ? (
          score /
          totalMarks
        ) * 100
      : 0;

  return {
    candidateName:
      candidateName,

    testCode:
      currentTest.code,

    testName:
      currentTest.name,

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

async function saveExamResult(
  result
) {

  /*
   IMPORTANT:
   This uses an "exam_results" table.

   Expected columns:

   id
   test_code
   test_name
   candidate_name
   correct
   wrong
   unanswered
   score
   total_marks
   percentage
   created_at
  */

  const payload = {
    test_code:
      result.testCode,

    test_name:
      result.testName,

    candidate_name:
      result.candidateName,

    correct:
      result.correct,

    wrong:
      result.wrong,

    unanswered:
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
      ${escapeHtml(
        result.candidateName
      )}
      •
      ${escapeHtml(
        result.testName
      )}
    </p>

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
   NUMBER FORMAT
   ========================================================= */

function formatNumber(
  number
) {

  return Number(
    number
  )
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );
}


/* =========================================================
   COPY TEST CODE
   ========================================================= */

$("copyCodeBtn")?.addEventListener(
  "click",
  async () => {

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

        const original =
          button.textContent;

        button.textContent =
          "Copied ✓";

        setTimeout(
          () => {
            button.textContent =
              original;
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

    pdfJsModule.GlobalWorkerOptions.workerSrc =
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
   PDF VIEWER SETUP
   ========================================================= */

function getPdfViewerContainer() {

  const existing =
    document.querySelector(
      "#pdfCanvasContainer"
    );

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

  return document.querySelector(
    "#pdfCanvasContainer"
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
          0.6,
          currentPdfScale -
            0.1
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
          2.5,
          currentPdfScale +
            0.1
        );

      updatePdfZoomText();

      renderPdfPage(
        currentPdfPage
      );
    }
  );
}


/* =========================================================
   PDF VIEWER
   ========================================================= */

async function initializePdfViewer(
  url
) {

  currentPdfUrl =
    url;

  const container =
    getPdfViewerContainer();

  if (!container) {
    return;
  }

  const loading =
    $("pdfLoading");

  const canvas =
    $("pdfCanvas");

  if (loading) {
    show(loading);

    loading.textContent =
      "Loading question paper...";
  }

  if (canvas) {
    canvas.style.display =
      "none";
  }

  try {

    const pdfjsLib =
      await loadPdfJs();

    currentPdfDocument =
      await pdfjsLib.getDocument({
        url,
        withCredentials:
          false
      }).promise;

    currentPdfPage =
      1;

    currentPdfScale =
      getInitialPdfScale();

    updatePdfZoomText();

    const fallback =
      $("pdfOpenFallback");

    if (fallback) {
      fallback.href =
        url;
    }

    await renderPdfPage(
      currentPdfPage
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
   INITIAL PDF SCALE
   ========================================================= */

function getInitialPdfScale() {

  const container =
    $("pdfCanvasContainer");

  if (!container) {
    return 1;
  }

  const width =
    container.clientWidth;

  if (width <= 500) {
    return 0.75;
  }

  if (width <= 800) {
    return 0.9;
  }

  return 1;
}


/* =========================================================
   PDF RENDER
   ========================================================= */

async function renderPdfPage(
  pageNumber
) {

  if (
    !currentPdfDocument ||
    pdfRendering
  ) {
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

  try {

    const page =
      await currentPdfDocument
        .getPage(
          pageNumber
        );

    let viewport =
      page.getViewport({
        scale:
          currentPdfScale
      });

    const availableWidth =
      Math.max(
        250,
        container.clientWidth -
          36
      );

    if (
      viewport.width >
      availableWidth
    ) {

      const fitScale =
        availableWidth /
        viewport.width;

      viewport =
        page.getViewport({
          scale:
            currentPdfScale *
            fitScale
        });
    }

    const deviceScale =
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      );

    canvas.width =
      Math.floor(
        viewport.width *
        deviceScale
      );

    canvas.height =
      Math.floor(
        viewport.height *
        deviceScale
      );

    canvas.style.width =
      `${viewport.width}px`;

    canvas.style.height =
      `${viewport.height}px`;

    const context =
      canvas.getContext(
        "2d"
      );

    context.setTransform(
      deviceScale,
      0,
      0,
      deviceScale,
      0,
      0
    );

    await page.render({
      canvasContext:
        context,

      viewport
    }).promise;

    canvas.style.display =
      "block";

    const loading =
      $("pdfLoading");

    if (loading) {
      hide(loading);
    }

    const pageInfo =
      $("pdfPageInfo");

    if (pageInfo) {
      pageInfo.textContent =
        `${pageNumber} / ${currentPdfDocument.numPages}`;
    }

    updatePdfButtons();

  } catch (error) {

    console.error(
      "PDF page render error:",
      error
    );

  } finally {

    pdfRendering =
      false;
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
      currentPdfPage <= 1;
  }

  if (next) {
    next.disabled =
      !currentPdfDocument ||
      currentPdfPage >=
        currentPdfDocument.numPages;
  }
}


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

let pdfResizeTimer = null;

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
            currentPdfDocument
          ) {
            renderPdfPage(
              currentPdfPage
            );
          }

        },
        180
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

    showScreen(
      "homeScreen"
    );
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

    const previewBox =
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

    if (pdfStatus) {
      pdfStatus.textContent =
        "";
    }

    hide(
      previewBox
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
      !Number.isInteger(
        count
      ) ||
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

$("defaultOptions")?.addEventListener(
  "change",
  () => {

    const selected =
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
            String(
              selected
            );
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

      $("joinBtn")?.click();
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

    /*
     * Make sure the home screen
     * is visible on first load.
     */

    const screens =
      document.querySelectorAll(
        ".screen"
      );

    const visibleScreen =
      Array.from(
        screens
      ).find(
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
   END OF SCRIPT
   ========================================================= */
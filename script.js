/* =========================================================
   EXAM OMR
   FINAL MAIN JAVASCRIPT
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

const STORAGE_BUCKET = "question-papers";

const OPTION_LABELS = ["A", "B", "C", "D"];

const SUBMISSIONS_TABLE = "submissions";


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

let currentCandidateName = "";

let currentSubmission = null;


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
   SAFE HTML
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
  ).map((select) =>
    normalizeOptionCount(
      select.value
    )
  );
}


/* =========================================================
   PDF FILE
   ========================================================= */

const pdfFileInput =
  $("pdfFile");

if (pdfFileInput) {
  pdfFileInput.addEventListener(
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

      show(previewBox);

      if (status) {
        status.textContent =
          `${file.name} selected.`;

        status.style.color =
          "#16a34a";
      }
    }
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

  const { error: uploadError } =
    await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(
        fileName,
        file,
        {
          cacheControl:
            "3600",
          upsert: false,
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
   CREATE TEST BUTTON
   ========================================================= */

const generateBtn =
  $("generateBtn");

if (generateBtn) {
  generateBtn.addEventListener(
    "click",
    async () => {
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
}


/* =========================================================
   SAVE TEST
   ========================================================= */

const saveTestBtn =
  $("saveTestBtn");

if (saveTestBtn) {
  saveTestBtn.addEventListener(
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

        const createdCode =
          $("createdCode");

        if (createdCode) {
          createdCode.textContent =
            testCreatedCode;
        }

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

  const { data, error } =
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
   CANDIDATE NAME
   ========================================================= */

function ensureCandidateNameField() {
  const joinCard =
    document.querySelector(
      ".join-card"
    );

  if (!joinCard) {
    return;
  }

  if (
    $("candidateName")
  ) {
    return;
  }

  const codeInput =
    $("joinCode");

  if (!codeInput) {
    return;
  }

  const label =
    document.createElement(
      "label"
    );

  label.textContent =
    "Candidate Name";

  const input =
    document.createElement(
      "input"
    );

  input.id =
    "candidateName";

  input.type =
    "text";

  input.placeholder =
    "Enter your full name";

  input.autocomplete =
    "name";

  codeInput.parentNode.insertBefore(
    label,
    codeInput
  );

  codeInput.parentNode.insertBefore(
    input,
    codeInput
  );
}


/* =========================================================
   JOIN TEST
   ========================================================= */

const joinBtn =
  $("joinBtn");

if (joinBtn) {
  joinBtn.addEventListener(
    "click",
    async () => {
      const code =
        $("joinCode")
          ?.value
          .trim()
          .toUpperCase();

      const candidateName =
        $("candidateName")
          ?.value
          .trim();

      const status =
        $("joinStatus");

      hideStatus(status);

      if (!candidateName) {
        showStatus(
          status,
          "Please enter your name.",
          "error"
        );
        return;
      }

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

        currentCandidateName =
          candidateName;

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

        setupPdfViewer(
          test.pdf_url
        );

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
}


/* =========================================================
   PDF VIEWER
   ========================================================= */

function setupPdfViewer(
  pdfUrl
) {
  const iframe =
    $("examPdf");

  if (!iframe) {
    return;
  }

  iframe.src =
    pdfUrl;

  iframe.setAttribute(
    "allow",
    "fullscreen"
  );

  iframe.style.width =
    "100%";

  iframe.style.minHeight =
    "600px";
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
              option;

            updateSelectedOption(
              i,
              option
            );

            updateProgress();
          }
        );

        const bubble =
          document.createElement(
            "span"
          );

        bubble.className =
          "answer-bubble";

        bubble.textContent =
          option;

        label.appendChild(
          input
        );

        label.appendChild(
          bubble
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
}


/* =========================================================
   RESET EXAM
   ========================================================= */

const resetExamBtn =
  $("resetExamBtn");

if (resetExamBtn) {
  resetExamBtn.addEventListener(
    "click",
    () => {
      const confirmed =
        confirm(
          "Are you sure you want to delete all selected answers?"
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
          ".answer-option"
        )
        .forEach(
          (label) => {
            label.classList.remove(
              "selected"
            );
          }
        );

      document
        .querySelectorAll(
          '.answer-option input[type="radio"]'
        )
        .forEach(
          (input) => {
            input.checked =
              false;
          }
        );

      hide(
        $("resultBox")
      );

      updateProgress();
    }
  );
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

const submitExamBtn =
  $("submitExamBtn");

if (submitExamBtn) {
  submitExamBtn.addEventListener(
    "click",
    async () => {
      if (!currentTest) {
        return;
      }

      const unanswered =
        selectedAnswers.filter(
          (answer) => !answer
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

      await calculateResult();
    }
  );
}


/* =========================================================
   CALCULATE RESULT
   ========================================================= */

async function calculateResult() {
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
      Math.abs(wrongMark)
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

  const result = {
    correct,
    wrong,
    unanswered,
    score,
    totalMarks,
    percentage
  };

  currentSubmission =
    result;

  renderResult(
    result
  );

  await saveSubmission(
    result
  );
}


/* =========================================================
   SAVE SUBMISSION
   ========================================================= */

async function saveSubmission(
  result
) {
  if (
    !currentTest ||
    !currentCandidateName
  ) {
    return;
  }

  try {
    const payload = {
      test_code:
        currentTest.code,

      candidate_name:
        currentCandidateName,

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

    const { error } =
      await supabaseClient
        .from(
          SUBMISSIONS_TABLE
        )
        .insert(
          payload
        );

    if (error) {
      console.error(
        "Could not save submission:",
        error
      );
    }
  } catch (error) {
    console.error(
      "Submission error:",
      error
    );
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

    <div class="result-candidate">
      <span>Candidate</span>
      <strong>
        ${escapeHtml(
          currentCandidateName
        )}
      </strong>
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

      <span>Score</span>

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

    <div class="result-saved">
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
   FORMAT NUMBER
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


/* =========================================================
   RESULT CHECK UI
   ========================================================= */

function createResultScreens() {
  if (
    $("resultCheckScreen")
  ) {
    return;
  }

  const main =
    document.querySelector(
      "main"
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

      <div class="section-header">

        <div>
          <h2>Check Result</h2>

          <p>
            Enter the same Test Code used for the examination.
          </p>
        </div>

        <button
          id="backHomeFromResult"
          class="small-btn secondary-btn"
        >
          ← Back
        </button>

      </div>

      <label>
        Test Code
      </label>

      <input
        id="resultTestCode"
        type="text"
        maxlength="6"
        placeholder="E.g. A7K92P"
        autocomplete="off"
      >

      <label>
        Candidate Name
      </label>

      <input
        id="resultCandidateName"
        type="text"
        placeholder="Enter candidate name"
        autocomplete="name"
      >

      <button
        id="checkMyResultBtn"
        class="primary-btn full-btn"
      >
        Check My Result
      </button>

      <div
        id="resultCheckStatus"
        class="status-box hidden"
      ></div>

      <div
        id="myResultBox"
        class="result-box hidden"
      ></div>

    </div>
  `;

  main.appendChild(
    section
  );

  $("backHomeFromResult")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );

  $("checkMyResultBtn")
    ?.addEventListener(
      "click",
      checkMyResult
    );
}


/* =========================================================
   ALL RESULTS SCREEN
   ========================================================= */

function createAllResultsScreen() {
  if (
    $("allResultsScreen")
  ) {
    return;
  }

  const main =
    document.querySelector(
      "main"
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      "section"
    );

  section.id =
    "allResultsScreen";

  section.className =
    "screen hidden";

  section.innerHTML = `
    <div class="card">

      <div class="section-header">

        <div>
          <h2>All Results</h2>

          <p>
            Enter a Test Code to view all submitted results.
          </p>
        </div>

        <button
          id="backHomeFromAllResults"
          class="small-btn secondary-btn"
        >
          ← Back
        </button>

      </div>

      <div class="result-search-row">

        <input
          id="allResultsCode"
          type="text"
          maxlength="6"
          placeholder="Enter Test Code"
          autocomplete="off"
        >

        <button
          id="loadAllResultsBtn"
          class="primary-btn"
        >
          View Results
        </button>

      </div>

      <div
        id="allResultsStatus"
        class="status-box hidden"
      ></div>

      <div
        id="allResultsContainer"
        class="all-results-container hidden"
      ></div>

    </div>
  `;

  main.appendChild(
    section
  );

  $("backHomeFromAllResults")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );

  $("loadAllResultsBtn")
    ?.addEventListener(
      "click",
      loadAllResults
    );
}


/* =========================================================
   CHECK MY RESULT
   ========================================================= */

async function checkMyResult() {
  const code =
    $("resultTestCode")
      ?.value
      .trim()
      .toUpperCase();

  const name =
    $("resultCandidateName")
      ?.value
      .trim();

  const status =
    $("resultCheckStatus");

  const resultBox =
    $("myResultBox");

  hide(resultBox);

  if (!code) {
    showStatus(
      status,
      "Please enter the Test Code.",
      "error"
    );
    return;
  }

  if (!name) {
    showStatus(
      status,
      "Please enter the candidate name.",
      "error"
    );
    return;
  }

  setLoading(
    true,
    "Checking result..."
  );

  try {
    const { data, error } =
      await supabaseClient
        .from(
          SUBMISSIONS_TABLE
        )
        .select("*")
        .eq(
          "test_code",
          code
        )
        .ilike(
          "candidate_name",
          name
        )
        .order(
          "submitted_at",
          {
            ascending: false
          }
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
        "No result found. Please check the Test Code and candidate name."
      );
    }

    renderSavedResult(
      data[0],
      resultBox
    );

    show(resultBox);

    hideStatus(status);

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
   RENDER SAVED RESULT
   ========================================================= */

function renderSavedResult(
  submission,
  container
) {
  const score =
    Number(
      submission.score
    ) || 0;

  const totalMarks =
    Number(
      submission.total_marks
    ) || 0;

  const percentage =
    Number(
      submission.percentage
    ) || 0;

  container.innerHTML = `
    <div class="result-title">
      Result
    </div>

    <div class="result-candidate">
      <span>Candidate</span>
      <strong>
        ${escapeHtml(
          submission.candidate_name
        )}
      </strong>
    </div>

    <div class="result-stats">

      <div class="result-stat">
        <span>Correct</span>
        <strong>
          ${submission.correct_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Wrong</span>
        <strong>
          ${submission.wrong_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Unanswered</span>
        <strong>
          ${submission.unanswered_count}
        </strong>
      </div>

      <div class="result-stat">
        <span>Percentage</span>
        <strong>
          ${percentage.toFixed(2)}%
        </strong>
      </div>

    </div>

    <div class="score-display">

      <span>Score</span>

      <strong>
        ${formatNumber(score)}
        /
        ${formatNumber(totalMarks)}
      </strong>

    </div>
  `;
}


/* =========================================================
   LOAD ALL RESULTS
   ========================================================= */

async function loadAllResults() {
  const code =
    $("allResultsCode")
      ?.value
      .trim()
      .toUpperCase();

  const status =
    $("allResultsStatus");

  const container =
    $("allResultsContainer");

  hide(container);

  if (!code) {
    showStatus(
      status,
      "Please enter a Test Code.",
      "error"
    );
    return;
  }

  setLoading(
    true,
    "Loading all results..."
  );

  try {
    const { data, error } =
      await supabaseClient
        .from(
          SUBMISSIONS_TABLE
        )
        .select("*")
        .eq(
          "test_code",
          code
        )
        .order(
          "score",
          {
            ascending: false
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
        "No submitted results found for this Test Code."
      );
    }

    renderAllResults(
      data,
      container
    );

    show(container);

    hideStatus(status);

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
  results,
  container
) {
  container.innerHTML = "";

  const title =
    document.createElement(
      "div"
    );

  title.className =
    "all-results-title";

  title.innerHTML = `
    <strong>
      ${results.length}
      Result${results.length === 1 ? "" : "s"}
    </strong>
  `;

  container.appendChild(
    title
  );

  results.forEach(
    (submission, index) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "result-row";

      row.innerHTML = `
        <div class="result-rank">
          ${index + 1}
        </div>

        <div class="result-person">

          <strong>
            ${escapeHtml(
              submission.candidate_name
            )}
          </strong>

          <span>
            ${submission.correct_count}
            correct •
            ${submission.wrong_count}
            wrong
          </span>

        </div>

        <div class="result-score">

          <strong>
            ${formatNumber(
              submission.score
            )}
            /
            ${formatNumber(
              submission.total_marks
            )}
          </strong>

          <span>
            ${Number(
              submission.percentage || 0
            ).toFixed(2)}%
          </span>

        </div>
      `;

      container.appendChild(
        row
      );
    }
  );
}


/* =========================================================
   HOME BUTTONS
   ========================================================= */

function setupHomeButtons() {
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

        ensureCandidateNameField();
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

  $("backHomeFromJoin")
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

  $("goHomeAfterCreate")
    ?.addEventListener(
      "click",
      () => {
        showScreen(
          "homeScreen"
        );
      }
    );

  $("copyCodeBtn")
    ?.addEventListener(
      "click",
      async () => {
        if (
          !testCreatedCode
        ) {
          return;
        }

        try {
          await navigator.clipboard.writeText(
            testCreatedCode
          );

          const button =
            $("copyCodeBtn");

          if (button) {
            const oldText =
              button.textContent;

            button.textContent =
              "Copied ✓";

            setTimeout(
              () => {
                button.textContent =
                  oldText;
              },
              1500
            );
          }
        } catch {
          alert(
            `Test Code: ${testCreatedCode}`
          );
        }
      }
    );

  $("exitExamBtn")
    ?.addEventListener(
      "click",
      () => {
        const confirmed =
          confirm(
            "Exit this exam?"
          );

        if (!confirmed) {
          return;
        }

        currentTest =
          null;

        currentCandidateName =
          "";

        selectedAnswers =
          [];

        showScreen(
          "homeScreen"
        );
      }
    );
}


/* =========================================================
   ADD RESULT BUTTONS
   ========================================================= */

function createHomeResultButtons() {
  const homeActions =
    document.querySelector(
      ".home-actions"
    );

  if (!homeActions) {
    return;
  }

  if (
    !$("showResultBtn")
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.id =
      "showResultBtn";

    button.className =
      "secondary-btn";

    button.textContent =
      "Check Result";

    homeActions.appendChild(
      button
    );

    button.addEventListener(
      "click",
      () => {
        createResultScreens();

        showScreen(
          "resultCheckScreen"
        );
      }
    );
  }

  if (
    !$("showAllResultsBtn")
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.id =
      "showAllResultsBtn";

    button.className =
      "secondary-btn";

    button.textContent =
      "Check Results";

    homeActions.appendChild(
      button
    );

    button.addEventListener(
      "click",
      () => {
        createAllResultsScreen();

        showScreen(
          "allResultsScreen"
        );
      }
    );
  }
}


/* =========================================================
   MOBILE PDF FALLBACK
   ========================================================= */

function setupMobilePdfFallback() {
  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    .mobile-pdf-link {
      display: none;
      margin-top: 10px;
    }

    @media (max-width: 650px) {
      .mobile-pdf-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
    }

    .result-candidate {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid var(--border);
    }

    .result-candidate span {
      color: var(--muted);
      font-size: 13px;
    }

    .result-candidate strong {
      font-size: 15px;
    }

    .result-saved {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 9px;
      background: var(--success-soft);
      color: var(--success);
      font-size: 13px;
      font-weight: 700;
    }

    .result-search-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }

    .all-results-container {
      margin-top: 18px;
    }

    .all-results-title {
      margin-bottom: 10px;
      font-size: 16px;
    }

    .result-row {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 13px;
      margin-bottom: 8px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
    }

    .result-rank {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary);
      font-weight: 850;
    }

    .result-person {
      min-width: 0;
    }

    .result-person strong,
    .result-person span {
      display: block;
    }

    .result-person strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-person span,
    .result-score span {
      color: var(--muted);
      font-size: 12px;
    }

    .result-score {
      text-align: right;
    }

    .result-score strong,
    .result-score span {
      display: block;
    }

    .answer-bubble {
      width: 25px;
      height: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      font-size: 12px;
      font-weight: 850;
    }

    .answer-option.selected .answer-bubble {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }

    @media (max-width: 650px) {
      .result-search-row {
        grid-template-columns: 1fr;
      }

      .result-row {
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 8px;
      }

      .result-score strong {
        font-size: 14px;
      }

      .result-candidate {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


/* =========================================================
   PDF OPEN BUTTON
   ========================================================= */

function addPdfOpenButton() {
  const pdfCard =
    document.querySelector(
      ".pdf-card"
    );

  if (!pdfCard) {
    return;
  }

  if (
    $("openPdfBtn")
  ) {
    return;
  }

  const button =
    document.createElement(
      "a"
    );

  button.id =
    "openPdfBtn";

  button.className =
    "secondary-btn mobile-pdf-link";

  button.target =
    "_blank";

  button.rel =
    "noopener";

  button.textContent =
    "Open Question Paper";

  pdfCard.insertBefore(
    button,
    $("examPdf")
  );

  const observer =
    new MutationObserver(
      () => {
        const iframe =
          $("examPdf");

        if (
          iframe &&
          iframe.src
        ) {
          button.href =
            iframe.src;
        }
      }
    );

  const iframe =
    $("examPdf");

  if (iframe) {
    observer.observe(
      iframe,
      {
        attributes: true,
        attributeFilter: [
          "src"
        ]
      }
    );
  }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupHomeButtons();

    createHomeResultButtons();

    setupMobilePdfFallback();

    addPdfOpenButton();

    ensureCandidateNameField();

    renderOptionSettings();
  }
);
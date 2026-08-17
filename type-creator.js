/* =========================================================
   EXAMORA — SMART TYPE QUESTION CREATOR
   =========================================================
   - Whole question-paper paste
   - Automatic question detection
   - Automatic A/B/C/D option detection
   - Compact answer-key support: ABCDABCD...
   - Numbered answer-key support: 1-A, 2-B...
   - Supabase JSONB storage
   - creation_type = "typed"
   - Exact question_count
   - PDF code untouched
   ========================================================= */

(() => {
  "use strict";

  let questions = [];
  let answerKey = [];
  let testCode = "";

  /* =======================================================
     HELPERS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeLine(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function show(el) {
    if (el) {
      el.classList.remove("hidden");
    }
  }

  function hide(el) {
    if (el) {
      el.classList.add("hidden");
    }
  }

  /* =======================================================
   BENGALI / ENGLISH NUMBER HELPERS
   ======================================================= */

function normalizeQuestionNumber(value) {
  const bengaliDigits = "০১২৩৪৫৬৭৮৯";
  const englishDigits = "0123456789";

  return String(value || "")
    .split("")
    .map(char => {
      const index = bengaliDigits.indexOf(char);

      return index >= 0
        ? englishDigits[index]
        : char;
    })
    .join("");
}


/* =======================================================
   QUESTION DETECTION
   ======================================================= */

function detectQuestion(line) {
  const text = normalizeLine(line);

  /*
   * Supports:
   *
   * 1. Question
   * 2) Question
   * 3: Question
   * ৪. প্রশ্ন
   * ৫) প্রশ্ন
   *
   * Both English and Bengali numerals.
   */

  let match = text.match(
    /^([0-9০-৯]{1,4})\s*[\.\):\-]\s*(.*)$/
  );

  if (match) {
    return {
      number: Number(
        normalizeQuestionNumber(match[1])
      ),
      text: match[2].trim()
    };
  }


  /*
   * Supports:
   *
   * Q1. Question
   * Q 1. Question
   * Q১. Question
   * Question 1. Question
   * Question ১. Question
   */

  match = text.match(
    /^Q(?:uestion)?\s*\.?\s*([0-9০-৯]{1,4})\s*[\.\):\-]?\s*(.*)$/i
  );

  if (match) {
    return {
      number: Number(
        normalizeQuestionNumber(match[1])
      ),
      text: match[2].trim()
    };
  }


  match = text.match(
    /^Question\s+([0-9০-৯]{1,4})\s*[\.\):\-]?\s*(.*)$/i
  );

  if (match) {
    return {
      number: Number(
        normalizeQuestionNumber(match[1])
      ),
      text: match[2].trim()
    };
  }


  return null;
}

  /* =======================================================
   OPTION LABEL NORMALIZER
   ======================================================= */

function normalizeOptionLabel(value) {
  const label =
    String(value || "")
      .trim()
      .toUpperCase();

  const bengaliToEnglish = {
    "ক": "A",
    "খ": "B",
    "গ": "C",
    "ঘ": "D"
  };

  if (
    bengaliToEnglish[label]
  ) {
    return bengaliToEnglish[label];
  }

  if (
    ["A", "B", "C", "D"].includes(label)
  ) {
    return label;
  }

  return "";
}


/* =======================================================
   OPTION DETECTION
   ======================================================= */

function detectOption(line) {
  const text =
    normalizeLine(line);

  /*
   * Supports:
   *
   * A) Option
   * B. Option
   * (C) Option
   * [D] Option
   *
   * Bengali:
   *
   * ক) Option
   * খ. Option
   * (গ) Option
   * [ঘ] Option
   */

  const match = text.match(
    /^\(?\[?([ABCDকখগঘ])\]?\)?\s*[\.\):\-]\s*(.+)$/i
  );

  if (!match) {
    return null;
  }

  const label =
    normalizeOptionLabel(
      match[1]
    );

  if (!label) {
    return null;
  }

  return {
    label,
    text: match[2].trim()
  };
}
  /* =======================================================
     PARSE QUESTION PAPER
     ======================================================= */

  function parseQuestionPaper(rawText) {
    const lines = String(rawText || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

    const result = [];

    let current = null;
    let currentOption = null;

    function finish() {
      if (!current) {
        return;
      }

      current.question =
        current.question
          .replace(/\s+/g, " ")
          .trim();

      for (const key of ["A", "B", "C", "D"]) {
        current.options[key] =
          current.options[key]
            .replace(/\s+/g, " ")
            .trim();
      }

      current.optionCount =
        current.options.C ||
        current.options.D
          ? 4
          : 2;

      if (current.question) {
        result.push(current);
      }

      current = null;
      currentOption = null;
    }

    for (const line of lines) {
      const question =
        detectQuestion(line);

      if (question) {
        finish();

        current = {
          number:
            question.number,

          question:
            question.text,

          options: {
            A: "",
            B: "",
            C: "",
            D: ""
          },

          optionCount: 4,

          answer: ""
        };

        continue;
      }

      if (!current) {
        continue;
      }

      const option =
        detectOption(line);

      if (option) {
        currentOption =
          option.label;

        current.options[
          currentOption
        ] =
          option.text;

        continue;
      }

      if (currentOption) {
        current.options[
          currentOption
        ] +=
          " " + line;

        continue;
      }

      current.question +=
        " " + line;
    }

    finish();

    return result;
  }

  /* =======================================================
     ANSWER KEY
     ======================================================= */

  function parseAnswerKey(
  rawText,
  count
) {
  const text =
    String(rawText || "")
      .trim();

  if (!text || !count) {
    return [];
  }


  /*
   * -------------------------------------------------------
   * NORMALIZE BENGALI NUMERALS
   * -------------------------------------------------------
   */

  const normalizedText =
    text
      .replace(
        /[০-৯]/g,
        digit => {
          const bengali =
            "০১২৩৪৫৬৭৮৯";

          const english =
            "0123456789";

          return english[
            bengali.indexOf(digit)
          ];
        }
      );


  /*
   * -------------------------------------------------------
   * OPTION NORMALIZER
   * -------------------------------------------------------
   */

  function normalizeAnswer(value) {
    const answer =
      String(value || "")
        .trim()
        .toUpperCase();

    const map = {
      "ক": "A",
      "খ": "B",
      "গ": "C",
      "ঘ": "D"
    };

    if (map[answer]) {
      return map[answer];
    }

    if (
      ["A", "B", "C", "D"]
        .includes(answer)
    ) {
      return answer;
    }

    return "";
  }


  /*
   * -------------------------------------------------------
   * FORMAT 1
   *
   * ABCDABCD...
   *
   * Also supports:
   *
   * কখগঘকখগঘ...
   * -------------------------------------------------------
   */

  const compactMatches =
    normalizedText.match(
      /[ABCD]/gi
    ) || [];

  const bengaliCompactMatches =
    text.match(
      /[কখগঘ]/g
    ) || [];

  /*
   * Prefer the Bengali compact sequence
   * when it contains enough answers.
   */

  if (
    bengaliCompactMatches.length === count
  ) {
    return bengaliCompactMatches.map(
      normalizeAnswer
    );
  }


  if (
    compactMatches.length === count
  ) {
    return compactMatches.map(
      normalizeAnswer
    );
  }


  /*
   * -------------------------------------------------------
   * FORMAT 2
   *
   * 1-A
   * 2-B
   * 3-C
   *
   * Bengali:
   *
   * ১-ক
   * ২-খ
   * ৩-গ
   *
   * Also supports:
   *
   * 1. A
   * 2. B
   * ১. ক
   * ২. খ
   * -------------------------------------------------------
   */

  const answers =
    new Array(count)
      .fill("");


  const regex =
    /([0-9০-৯]{1,4})\s*[\.\-:\)]?\s*[\(\[]?\s*([ABCDকখগঘ])\s*[\)\]]?/gi;


  let match;

  while (
    (match = regex.exec(text))
  ) {
    const number =
      Number(
        normalizeQuestionNumber(
          match[1]
        )
      );

    const answer =
      normalizeAnswer(
        match[2]
      );

    if (
      number >= 1 &&
      number <= count &&
      answer
    ) {
      answers[number - 1] =
        answer;
    }
  }


  return answers;
}
  /* =======================================================
     PARSE BUTTON
     ======================================================= */

  function parseQuestions() {
    const textarea =
      $("typedQuestionPaper");

    if (!textarea) {
      return;
    }

    const raw =
      textarea.value.trim();

    if (!raw) {
      alert(
        "Please paste the question paper first."
      );

      return;
    }

    const parsed =
      parseQuestionPaper(raw);

    if (!parsed.length) {
      alert(
        "Examora could not detect any numbered questions.\n\n" +
        "Example:\n\n" +
        "1. What is the capital of India?\n" +
        "(A) Mumbai\n" +
        "(B) Delhi\n" +
        "(C) Kolkata\n" +
        "(D) Chennai"
      );

      return;
    }

    questions =
      parsed;

    answerKey =
      new Array(
        questions.length
      ).fill("");

    updateCount();

    renderPreview();

    show(
      $("typedAnswerSection")
    );

    updateAnswerStatus(
      `${questions.length} questions detected.`
    );
  }

  /* =======================================================
     COUNT
     ======================================================= */

  function updateCount() {
    const count =
      questions.length;

    const display =
      $("typedParsedCount");

    if (display) {
      display.textContent =
        `${count} question${
          count === 1
            ? ""
            : "s"
        } detected`;
    }

    const input =
      $("typedQuestionCount");

    if (input) {
      input.value =
        count;
    }
  }

  /* =======================================================
     APPLY ANSWER KEY
     ======================================================= */

  function applyAnswerKey() {
    if (!questions.length) {
      alert(
        "Parse the questions first."
      );

      return;
    }

    const input =
      $("typedAnswerKeyInput");

    const parsed =
      parseAnswerKey(
        input?.value || "",
        questions.length
      );

    if (
      parsed.length !==
      questions.length
    ) {
      updateAnswerStatus(
        `Expected ${questions.length} answers, but the answer key could not be completely parsed.`
      );

      return;
    }

    const missing =
      parsed.some(
        answer => !answer
      );

    if (missing) {
      updateAnswerStatus(
        "Some answers are missing from the answer key."
      );

      return;
    }

    const invalid =
      questions.some(
        (question, index) => {

          const allowed =
            question.optionCount === 2
              ? ["A", "B"]
              : ["A", "B", "C", "D"];

          return !allowed.includes(
            parsed[index]
          );
        }
      );

    if (invalid) {
      updateAnswerStatus(
        "An answer does not match the available options."
      );

      return;
    }

    answerKey =
      parsed;

    questions.forEach(
      (question, index) => {
        question.answer =
          answerKey[index];
      }
    );

    updateAnswerStatus(
      "✓ Answer key applied successfully."
    );

    renderPreview();
  }

  /* =======================================================
     STATUS
     ======================================================= */

  function updateAnswerStatus(message) {
    const box =
      $("typedAnswerStatus");

    if (!box) {
      return;
    }

    box.textContent =
      message;

    show(box);
  }

  /* =======================================================
     PREVIEW
     ======================================================= */

  function renderPreview() {
    const container =
      $("typedQuestionPreview");

    if (!container) {
      return;
    }

    if (!questions.length) {
      container.innerHTML = `
        <div class="typed-empty-state">
          No questions detected yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      questions.map(
        question => {

          const labels =
            question.optionCount === 2
              ? ["A", "B"]
              : ["A", "B", "C", "D"];

          return `
            <article
              class="typed-preview-question"
            >

              <div
                class="typed-preview-header"
              >

                <div>

                  <span
                    class="typed-preview-number"
                  >
                    QUESTION
                    ${question.number}
                  </span>

                  <strong>
                    ${escapeHtml(
                      question.question
                    )}
                  </strong>

                </div>

                ${
                  question.answer
                    ? `
                      <span
                        class="typed-answer-pill"
                      >
                        ${question.answer}
                      </span>
                    `
                    : `
                      <span
                        class="typed-unanswered-pill"
                      >
                        —
                      </span>
                    `
                }

              </div>

              <div
                class="typed-preview-options"
              >

                ${labels.map(
                  label => `
                    <div
                      class="
                        typed-preview-option
                        ${
                          question.answer === label
                            ? "correct"
                            : ""
                        }
                      "
                    >

                      <span>
                        ${label}
                      </span>

                      <p>
                        ${escapeHtml(
                          question.options[label]
                        )}
                      </p>

                    </div>
                  `
                ).join("")}

              </div>

            </article>
          `;
        }
      ).join("");
  }

  /* =======================================================
     TEST CODE
     ======================================================= */

  async function createCode() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (
      let attempt = 0;
      attempt < 20;
      attempt++
    ) {

      let code = "";

      for (
        let i = 0;
        i < 6;
        i++
      ) {
        code +=
          chars[
            Math.floor(
              Math.random() *
              chars.length
            )
          ];
      }

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

      if (!data?.length) {
        return code;
      }
    }

    throw new Error(
      "Could not generate a unique test code."
    );
  }

  /* =======================================================
     BUILD JSONB
     ======================================================= */

  function buildQuestionData() {
    return {
      version: 1,

      creation_type:
        "typed",

      questions:
        questions.map(
          question => ({
            number:
              question.number,

            question:
              question.question,

            options: {
              A:
                question.options.A,

              B:
                question.options.B,

              C:
                question.options.C,

              D:
                question.options.D
            },

            option_count:
              question.optionCount,

            answer:
              question.answer
          })
        ),

      answer_key:
        questions.map(
          question =>
            question.answer
        )
    };
  }

  /* =======================================================
     CREATE TEST
     ======================================================= */

  async function createTypedTest() {

    if (!questions.length) {
      alert(
        "Please parse the question paper first."
      );

      return;
    }

    const missing =
      questions.filter(
        question =>
          !question.answer
      );

    if (missing.length) {
      alert(
        "Please apply a complete answer key first.\n\n" +
        "Missing answers for question(s): " +
        missing
          .map(q => q.number)
          .join(", ")
      );

      return;
    }

    const name =
      $("typedTestName")
        ?.value
        ?.trim();

    if (!name) {
      alert(
        "Please enter a test name."
      );

      return;
    }

    const correctMark =
      Number(
        $("typedCorrectMark")
          ?.value
      );

    const wrongMark =
      Number(
        $("typedWrongMark")
          ?.value
      );

    const duration =
      Number(
        $("typedDurationMinutes")
          ?.value
      ) || 0;

    if (
      !Number.isFinite(
        correctMark
      )
    ) {
      alert(
        "Enter a valid correct mark."
      );

      return;
    }

    if (
      !Number.isFinite(
        wrongMark
      )
    ) {
      alert(
        "Enter a valid negative mark."
      );

      return;
    }

    const button =
      $("createTypedTestBtn");

    if (button) {
      button.disabled = true;
      button.textContent =
        "Creating Test...";
    }

    try {

      testCode =
        await createCode();

      const questionData =
        buildQuestionData();

      /*
       * IMPORTANT:
       *
       * question_count is ALWAYS
       * questions.length.
       *
       * No 40 fallback.
       */

      const payload = {

        name,

        pdf_url:
          null,

        question_count:
          questions.length,

        options:
          questions.map(
            question =>
              question.options
          ),

        answer_key:
          questions.map(
            question =>
              question.answer
          ),

        correct_mark:
          correctMark,

        wrong_mark:
          wrongMark,

        code:
          testCode,

        duration_minutes:
          duration,

        question_data:
          questionData,

        creation_type:
          "typed"
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

      /*
       * Keep a small local copy too.
       * This is only a convenience/cache.
       * Supabase is now the source of truth.
       */

      localStorage.setItem(
        `examora_typed_${testCode}`,
        JSON.stringify(data)
      );

      showCreated(
        testCode
      );

    } catch (error) {

      console.error(
        "Examora Type Test Error:",
        error
      );

      alert(
        error?.message ||
        "Could not create the test."
      );

    } finally {

      if (button) {
        button.disabled = false;
        button.textContent =
          "Create Test";
      }
    }
  }

  /* =======================================================
     CREATED SCREEN
     ======================================================= */

  function showCreated(code) {

    const created =
      $("createdScreen");

    const create =
      $("createScreen");

    if (
      created &&
      create
    ) {

      document
        .querySelectorAll(".screen")
        .forEach(
          screen =>
            screen.classList.add(
              "hidden"
            )
        );

      created.classList.remove(
        "hidden"
      );
    }

    const codeElement =
      $("createdCode");

    if (codeElement) {
      codeElement.textContent =
        code;
    }
  }

  /* =======================================================
     CLEAR
     ======================================================= */

  function clearAll() {

    questions = [];
    answerKey = [];
    testCode = "";

    [
      "typedTestName",
      "typedQuestionPaper",
      "typedAnswerKeyInput"
    ].forEach(
      id => {
        const element =
          $(id);

        if (element) {
          element.value = "";
        }
      }
    );

    const count =
      $("typedQuestionCount");

    if (count) {
      count.value = "0";
    }

    const display =
      $("typedParsedCount");

    if (display) {
      display.textContent =
        "0 questions detected";
    }

    const preview =
      $("typedQuestionPreview");

    if (preview) {
      preview.innerHTML = `
        <div class="typed-empty-state">
          Paste your question paper above
          and click Parse Questions.
        </div>
      `;
    }

    hide(
      $("typedAnswerSection")
    );

    hide(
      $("typedAnswerStatus")
    );
  }

  /* =======================================================
     OPEN / CLOSE
     ======================================================= */

  function openCreator() {

    buildUI();

    const panel =
      $("examoraTypedCreator");

    if (!panel) {
      return;
    }

    show(panel);

    hide(
      $("createModeSelector")
    );

    /*
     * Only hide the creation panels.
     * PDF implementation itself is untouched.
     */

    const pdfMode =
      $("pdfCreateMode");

    if (pdfMode) {
      hide(pdfMode);
    }
  }

  function closeCreator() {

    hide(
      $("examoraTypedCreator")
    );

    show(
      $("createModeSelector")
    );

    /*
     * Restore the normal PDF creation UI.
     * We do NOT reset PDF state.
     */

    show(
      $("pdfCreateMode")
    );
  }

  /* =======================================================
     UI
     ======================================================= */

  function buildUI() {

    if (
      $("examoraTypedCreator")
    ) {
      return;
    }

    const createScreen =
      $("createScreen");

    if (!createScreen) {
      return;
    }

    const selector =
      $("createModeSelector");

    const panel =
      document.createElement(
        "div"
      );

    panel.id =
      "examoraTypedCreator";

    panel.className =
      "typed-creator-panel hidden";

    panel.innerHTML = `

      <div
        class="typed-creator-top"
      >

        <div>

          <div
            class="section-eyebrow"
          >
            SMART QUESTION BUILDER
          </div>

          <h3
            class="sub-heading"
          >
            Type Questions
          </h3>

          <p
            class="hint"
          >
            Paste the complete question paper.
            Examora will detect the questions
            and options automatically.
          </p>

        </div>

        <button
          type="button"
          id="closeTypedCreatorBtn"
          class="small-btn secondary-btn"
        >
          ← Back
        </button>

      </div>


      <div
        class="form-grid"
      >

        <div>

          <label>
            Test Name
          </label>

          <input
            id="typedTestName"
            type="text"
            placeholder="e.g. English Test 1"
          >

        </div>


        <div>

          <label>
            Questions Detected
          </label>

          <input
            id="typedQuestionCount"
            type="number"
            value="0"
            readonly
          >

        </div>


        <div>

          <label>
            Duration
          </label>

          <select
            id="typedDurationMinutes"
          >

            <option value="0">
              No Timer
            </option>

            <option value="15">
              15 Minutes
            </option>

            <option value="30">
              30 Minutes
            </option>

            <option value="45">
              45 Minutes
            </option>

            <option
              value="60"
              selected
            >
              60 Minutes
            </option>

            <option value="90">
              90 Minutes
            </option>

            <option value="120">
              120 Minutes
            </option>

            <option value="180">
              180 Minutes
            </option>

          </select>

        </div>

      </div>


      <div
        class="typed-paper-section"
      >

        <div
          class="typed-section-header"
        >

          <div>

            <strong>
              Question Paper
            </strong>

            <span>
              Paste everything at once.
            </span>

          </div>

          <span
            id="typedParsedCount"
            class="typed-count-badge"
          >
            0 questions detected
          </span>

        </div>


        <textarea
          id="typedQuestionPaper"
          class="typed-paper-input"
          rows="18"
          placeholder="1. What is the capital of India?
(A) Mumbai
(B) Delhi
(C) Kolkata
(D) Chennai

2. Which planet is known as the Red Planet?
(A) Earth
(B) Venus
(C) Mars
(D) Jupiter"
        ></textarea>


        <div
          class="actions"
        >

          <button
            type="button"
            id="parseTypedQuestionsBtn"
            class="primary-btn"
          >
            Parse Questions
          </button>

          <button
            type="button"
            id="clearTypedQuestionsBtn"
            class="secondary-btn"
          >
            Clear
          </button>

        </div>

      </div>


      <div
        id="typedAnswerSection"
        class="typed-answer-section hidden"
      >

        <div
          class="typed-section-header"
        >

          <div>

            <strong>
              Answer Key
            </strong>

            <span>
              Paste ABCD... or numbered answers.
            </span>

          </div>

        </div>


        <textarea
          id="typedAnswerKeyInput"
          class="typed-answer-input"
          rows="5"
          placeholder="ABCDADCB...

or

1-A
2-B
3-C
4-D"
        ></textarea>


        <div
          class="actions"
        >

          <button
            type="button"
            id="applyTypedAnswerKeyBtn"
            class="secondary-btn"
          >
            Apply Answer Key
          </button>

        </div>


        <div
          id="typedAnswerStatus"
          class="typed-answer-status hidden"
        ></div>

      </div>


      <div
        class="typed-mark-section"
      >

        <div>

          <label>
            Marks for Correct Answer
          </label>

          <input
            id="typedCorrectMark"
            type="number"
            step="0.25"
            value="1"
          >

        </div>


        <div>

          <label>
            Negative Marks
          </label>

          <input
            id="typedWrongMark"
            type="number"
            step="0.25"
            value="0"
          >

        </div>

      </div>


      <div
        class="typed-preview-section"
      >

        <div
          class="typed-section-header"
        >

          <div>

            <strong>
              Question Preview
            </strong>

            <span>
              Check everything before publishing.
            </span>

          </div>

        </div>


        <div
          id="typedQuestionPreview"
          class="typed-question-preview"
        >

          <div
            class="typed-empty-state"
          >
            Paste your question paper above
            and click Parse Questions.
          </div>

        </div>

      </div>


      <div
        class="actions typed-final-actions"
      >

        <button
          type="button"
          id="createTypedTestBtn"
          class="primary-btn"
        >
          Create Test
        </button>

        <button
          type="button"
          id="closeTypedCreatorBtnBottom"
          class="secondary-btn"
        >
          ← Back
        </button>

      </div>

    `;

    if (selector) {

      selector.parentNode.insertBefore(
        panel,
        selector.nextSibling
      );

    } else {

      createScreen.appendChild(
        panel
      );
    }

    bindEvents();
  }

  /* =======================================================
     EVENTS
     ======================================================= */

  function bindEvents() {

    $("parseTypedQuestionsBtn")
      ?.addEventListener(
        "click",
        parseQuestions
      );

    $("applyTypedAnswerKeyBtn")
      ?.addEventListener(
        "click",
        applyAnswerKey
      );

    $("createTypedTestBtn")
      ?.addEventListener(
        "click",
        createTypedTest
      );

    $("clearTypedQuestionsBtn")
      ?.addEventListener(
        "click",
        clearAll
      );

    $("closeTypedCreatorBtn")
      ?.addEventListener(
        "click",
        closeCreator
      );

    $("closeTypedCreatorBtnBottom")
      ?.addEventListener(
        "click",
        closeCreator
      );
  }

  /* =======================================================
     CONNECT EXISTING TYPE BUTTON
     ======================================================= */

  function connectTypeButton() {

    const button =
      $("createModeTypeBtn");

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopImmediatePropagation();

        openCreator();

      },
      true
    );
  }

  /* =======================================================
     INITIALIZE
     ======================================================= */

  function init() {

    buildUI();

    connectTypeButton();

    console.log(
      "✓ Examora Smart Type Creator loaded"
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.ExamoraTypeCreator = {

    open:
      openCreator,

    close:
      closeCreator,

    parse:
      parseQuestionPaper,

    parseAnswerKey,

    getQuestions:
      () =>
        JSON.parse(
          JSON.stringify(
            questions
          )
        ),

    getAnswerKey:
      () =>
        [...answerKey]
  };

})();
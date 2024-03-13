// Initialize variables for managing chat personas, message timing, and state.
let PERSONA_1_PROMPT = "";
let PERSONA_1_PROMPT_PREFIX = "";
let PERSONA_2_PROMPT = "";
let PERSONA_2_PROMPT_PREFIX = "";
let currentRole = "";
let currentPromptPrefix = "";
let lastRequestTime = 0; // Last time a request was sent
let delaySeconds = 4; // Delay between messages
let isSendingMessages = false; // Flag to control message sending
var prompts = []; // Array to store prompt data

// This function runs when the document is fully loaded.
$(document).ready(function () {
  // Show disclaimer modal if it hasn't been acknowledged before.
  if (!document.cookie.includes("disclaimer_ack=true")) {
    var disclaimerModal = new bootstrap.Modal($("#disclaimer-modal"));
    disclaimerModal.show();
    // Set a cookie to remember that the disclaimer has been acknowledged.
    document.cookie =
      "disclaimer_ack=true; expires=" +
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  }

  // Load prompts from a JSON file and add them to the dropdown.
  $.getJSON("prompts.json", function (data) {
    prompts = data.prompts;
    $.each(prompts, function (i, prompt) {
      var $option = $("<option>").val(i).text(prompt.title);
      $("#prompt-select").append($option);
    });
    $("#prompt-select").val("");
  });

  // Disable message input, prompt selection, and send button if no API key is stored.
  if (!localStorage.getItem("api_key")) {
    $("#message-input, #prompt-select, #message-send").prop("disabled", true);
  }

  // Handle API key form submission to enable message sending.
  $("#API-input-form").submit(function (event) {
    event.preventDefault(); // Prevent form submission
    var form = this;
    if (!form.checkValidity()) {
      form.classList.add("was-validated"); // Show validation feedback
    } else {
      const apiKey = $("#apiKeyInput").val();
      form.classList.remove("was-validated"); // Hide validation feedback
      localStorage.setItem("api_key", apiKey); // Store API key locally
      $("#message-input, #prompt-select, #message-send").prop(
        "disabled",
        false
      ); // Enable inputs
      $("#apiKeyModal").modal("hide"); // Hide API key modal
    }
  });

  // Stop button functionality to halt message sending
  $("#message-stop").click(function (event) {
    isSendingMessages = false; // Stop message sending
    $(this).prop("disabled", false); // Disable stop button
    // Re-enable other inputs except for the stop button
    $("#chat-form").find(":input").not("#message-stop").prop("disabled", false);
    console.log("Stop button clicked. Message sending is halted.");
    $("#message-stop").prop("disabled", false); // Re-enable stop button
  });
});

// Handle prompt selection changes
$("#prompt-select").change(function () {
  var index = this.value;
  var prompt = prompts[index];

  // Set persona prompts and prefixes based on selected prompt
  PERSONA_1_PROMPT = prompt.persona1Prompt.text;
  PERSONA_1_PROMPT_PREFIX = prompt.persona1Prompt.prefix;
  PERSONA_2_PROMPT = prompt.persona2Prompt.text;
  PERSONA_2_PROMPT_PREFIX = prompt.persona2Prompt.prefix;

  currentRole = PERSONA_2_PROMPT; // Set current role for message sending
  currentPromptPrefix = PERSONA_2_PROMPT_PREFIX; // Set current prompt prefix
});

// Handle chat form submission
$("#chat-form").submit(function (event) {
  event.preventDefault(); // Prevent default form submission
  var form = this;
  if (!form.checkValidity()) {
    form.classList.add("was-validated"); // Show validation feedback
  } else {
    const message = $("#message-input").val().trim(); // Get trimmed message input
    form.classList.remove("was-validated"); // Hide validation feedback
    $(this).find(":input").prop("disabled", true); // Disable form inputs

    // Check if message is not empty
    if (message !== "") {
      isSendingMessages = true; // Start message sending
      printMessage("bot1", message, true); // Print user message

      // Send message request and handle response
      sendRequest(currentRole, currentPromptPrefix + message)
        .then((response) => {
          if (!isSendingMessages) return; // If stopped, do not proceed
          $("#typing-element").remove(); // Remove typing indicator
          if (response.code === 200) {
            // If response is successful
            const text = response.data.choices[0].message.content.trim(); // Get response message
            printMessage("bot2", text, true); // Print AI response
            sendRecursiveRequest(text, currentRole); // Send follow-up request
          } else {
            // Handle error response
            printMessage(
              "bot2",
              "Sorry, something went wrong. Please check the browser console for more information."
            );
            console.error(JSON.stringify(response));
          }
        })
        .catch((error) => {
          // Handle request error
          if (!isSendingMessages) return; // If stopped, do not proceed
          printMessage(
            "bot2",
            "Sorry, something went wrong. Please check the browser console for more information."
          );
          console.error(error);
        });

      $("#message-input").val(""); // Clear message input
    } else {
      // Re-enable inputs if no message is being sent
      $(this).find(":input").prop("disabled", false);
    }
  }
});

// Function to print messages in chat
function printMessage(sender, message, isTyping) {
  const chatContainer = $("#chat-container"); // Get chat container
  const messageClass = sender === "bot1" ? "bot1" : "bot2"; // Determine message class based on sender
  // Create and append message element
  const messageElement = $("<div>")
    .addClass("chat-message")
    .addClass(messageClass)
    .text(message);
  chatContainer.append(messageElement);

  // If typing indicator is needed, add it
  if (isTyping) {
    const messageClass1 = sender === "bot2" ? "bot1" : "bot2"; // Alternate message class for typing indicator
    const typingElement = $("<div>")
      .addClass("chat-message")
      .addClass(messageClass1)
      .text("typing...");
    typingElement.addClass("typing").attr("id", "typing-element");
    chatContainer.append(typingElement);
  }
  // Scroll chat container to bottom
  chatContainer.scrollTop(chatContainer.prop("scrollHeight"));
}

// Function to send recursive requests for conversation continuity
async function sendRecursiveRequest(prompt, currentRole) {
  // Alternate between persona prompts and prefixes for conversation flow
  if (currentRole === PERSONA_2_PROMPT) {
    currentRole = PERSONA_1_PROMPT;
    currentPromptPrefix = PERSONA_1_PROMPT_PREFIX;
    currentReply = "bot1";
  } else {
    currentRole = PERSONA_2_PROMPT;
    currentPromptPrefix = PERSONA_2_PROMPT_PREFIX;
    currentReply = "bot2";
  }

  try {
    await waitBeforeRequest(); // Wait if necessary before sending next request
    const response = await sendRequest(
      currentRole,
      currentPromptPrefix + prompt
    ); // Send request
    $("#typing-element").remove(); // Remove typing indicator
    if (response.code === 200) {
      // If response is successful
      const text = response.data.choices[0].message.content.trim(); // Get response message
      printMessage(currentReply, text, true); // Print response message
      sendRecursiveRequest(text, currentRole); // Send follow-up request for continuity
    } else {
      // Handle error response
      printMessage(
        "bot2",
        "Sorry, something went wrong. Please check the browser console for more information."
      );
      console.error(JSON.stringify(response));
    }
  } catch (error) {
    // Handle request error
    printMessage(
      "bot2",
      "Sorry, something went wrong. Please check the browser console for more information."
    );
    console.error(error);
  }
}

// Function to implement delay between requests if necessary
async function waitBeforeRequest() {
  const currentTime = Date.now(); // Get current time
  const timeSinceLastRequest = currentTime - lastRequestTime; // Calculate time since last request
  if (timeSinceLastRequest < delaySeconds * 1000) {
    // If time since last request is less than specified delay
    const timeToWait = delaySeconds * 1000 - timeSinceLastRequest; // Calculate how long to wait
    await new Promise((resolve) => setTimeout(resolve, timeToWait)); // Wait for the calculated duration
  }
  lastRequestTime = Date.now(); // Update last request time
}

// Function to send message request to AI service
async function sendRequest(prompt, msgInput) {
  const API_KEY = localStorage.getItem("api_key")
    ? localStorage.getItem("api_key").toString()
    : null; // Get API key from local storage
  // Configure request options
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`, // Include authorization header with API key
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo", // Specify model
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: msgInput },
      ], // Include prompt and user message
      temperature: 0.8, // Set creativity level
      max_tokens: 200, // Limit response length
    }),
  };
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    requestOptions
  ); // Send request
  const data = await response.json(); // Parse response data
  return {
    code: response.status, // Return response status code
    data: data, // Return response data
  };
}

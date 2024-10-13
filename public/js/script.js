let currentChildIndex = 0;
let children = [];
let userEmail = ""; // Variable to store the user's email

document.getElementById("emailSubmit").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  userEmail = email; // Store the email for later use

  try {
    const response = await fetch(
      `/check-email?email=${encodeURIComponent(email)}`
    );
    if (!response.ok) throw new Error("Server error");

    const result = await response.json();

    if (result.success) {
      // Store all children
      children = result.children;

      // Proceed to upload for the first child
      proceedToUploadForChild(currentChildIndex);
    } else {
      document.getElementById("emailError").innerText = result.message;
    }
  } catch (error) {
    console.error("Error:", error.message);
    document.getElementById("emailError").innerText =
      "Looks like this email was previously used to submit. Please try again with your correct email. If this is a mistake, please contact admin.";
  }
});

document
  .getElementById("fileInput")
  .addEventListener("change", handleFileUpload);

const dragDropArea = document.getElementById("dragDropArea");
dragDropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dragDropArea.style.borderColor = "#4a90e2"; // Highlight on dragover
});

dragDropArea.addEventListener("dragleave", () => {
  dragDropArea.style.borderColor = "#ccc"; // Reset border
});

dragDropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  handleFileUpload({ target: { files } });
});

function proceedToUploadForChild(index) {
  if (index >= children.length) {
    // All submissions are complete, display the thank-you message and hide the upload section
    document.getElementById("step2").classList.add("hidden"); // Hide the file upload section
    document.getElementById("confirmation").classList.remove("hidden"); // Show the thank-you message
    return; // Stop further processing
  }

  const child = children[index];

  if (child.status === "Done") {
    // Skip already submitted child and move to the next one
    currentChildIndex++;
    proceedToUploadForChild(currentChildIndex);
  } else {
    // Clear the previous file input and image preview
    document.getElementById("fileInput").value = ""; // Clear file input
    document.getElementById("preview").src = ""; // Clear the image preview
    document.getElementById("previewContainer").classList.add("hidden"); // Hide the preview container

    // Display the child's name and allow file upload
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
    document.getElementById("childName").innerText = child.childName; // Display the child's name
    document.getElementById("childName").setAttribute("data-age", child.age); // Store the age as a data attribute
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];

  if (file && file.size <= 3 * 1024 * 1024) {
    // Check file size
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("preview").src = e.target.result;
      document.getElementById("previewContainer").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById("uploadError").innerText =
      "File size must be less than 3MB.";
  }
}

document.getElementById("confirmUpload").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  // Add the child's name, age, and email to the form data
  const childName = document.getElementById("childName").innerText;
  const age = document.getElementById("childName").getAttribute("data-age");

  formData.append("childName", childName);
  formData.append("age", age);
  formData.append("email", userEmail); // Include the stored email

  try {
    const response = await fetch("/upload-image", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      // Display a confirmation alert to the user
      alert(`Submission complete for ${childName}.`);

      // Mark this child as done and proceed to the next one
      currentChildIndex++;
      proceedToUploadForChild(currentChildIndex);
    } else {
      const errorResponse = await response.json();
      document.getElementById("uploadError").innerText =
        errorResponse.error || "Error uploading the image.";
    }
  } catch (error) {
    console.error("Error:", error.message);
    document.getElementById("uploadError").innerText =
      "Error uploading the image.";
  }
});

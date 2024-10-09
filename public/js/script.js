document.getElementById("emailSubmit").addEventListener("click", async () => {
  const email = document.getElementById("email").value;

  const response = await fetch(`/check-email?email=${email}`);
  const result = await response.json();

  if (result.success) {
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
    document.getElementById("childName").innerText = `'${result.childName}'`;
  } else {
    document.getElementById("emailError").innerText = result.message;
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

function handleFileUpload(event) {
  const file = event.target.files[0];

  if (file && file.size <= 4 * 1024 * 1024) {
    // Check file size
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("preview").src = e.target.result;
      document.getElementById("previewContainer").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById("uploadError").innerText =
      "File size must be less than 4MB.";
  }
}

document.getElementById("confirmUpload").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const response = await fetch("/upload-image", {
    method: "POST",
    body: formData,
  });

  if (response.ok) {
    document.getElementById("step2").classList.add("hidden");
    document.getElementById("confirmation").classList.remove("hidden");
  } else {
    document.getElementById("uploadError").innerText =
      "Error uploading the image.";
  }
});

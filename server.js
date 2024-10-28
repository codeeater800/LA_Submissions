const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { google } = require("googleapis");

const SERVICE_ACCOUNT_FILE = path.join(__dirname, "service-account.json");
const DRIVE_FOLDER_ID = "1g3kzdcoHN-Fzh0CvCgrVGmZJaevtUxMD";

const app = express();
const PORT = process.env.PORT || 3000;

let latestAgeCategory = null; // Store the latest category based on age

// Load service account credentials from environment variable
function authorizeServiceAccount() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return auth;
}

// Upload file to Google Drive
async function uploadToDrive(auth, filePath, fileName) {
  const drive = google.drive({ version: "v3", auth });
  const fileMetadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID],
  };
  const media = {
    mimeType: "image/jpeg", // Adjust the MIME type as needed
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });
    console.log(`File uploaded to Google Drive with ID: ${response.data.id}`);
  } catch (error) {
    console.error("Error uploading to Google Drive:", error.message);
  }
}

// Middleware to serve static files
app.use(express.static("public"));
app.use(express.json()); // To handle JSON form data
app.use(express.urlencoded({ extended: true })); // Middleware to handle non-file form data

// Set up Multer for file uploads with categorized directories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let categoryDir = "public/uploads";

    // Use a default category initially, this will be updated in the route
    cb(null, categoryDir);
  },
  filename: (req, file, cb) => {
    const uniqueNumber = Date.now();
    const fileName = `${uniqueNumber}${path.extname(file.originalname)}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });

// Function to write updated CSV data
function updateCSV(data) {
  const csvWriter = createCsvWriter({
    path: "data/image-ref-registrations.csv",
    header: [
      { id: "Child Name", title: "Child Name" },
      { id: "Parent Name", title: "Parent Name" },
      { id: "Date of Birth", title: "Date of Birth" },
      { id: "Age", title: "Age" },
      { id: "Gender", title: "Gender" },
      { id: "Education Board", title: "Education Board" },
      { id: "Grade", title: "Grade" },
      { id: "Section", title: "Section" },
      { id: "Country Code", title: "Country Code" },
      { id: "Phone Number", title: "Phone Number" },
      { id: "Email", title: "Email" },
      { id: "Registration ID", title: "Registration ID" },
      { id: "Submission-Status", title: "Submission-Status" },
    ],
  });

  return csvWriter.writeRecords(data); // Returns a promise
}

// Endpoint to check email and fetch all children associated with the email
app.get("/check-email", (req, res) => {
  const email = req.query.email;
  const results = [];

  // Logging the input email
  console.log(`User inputted email: ${email}`);

  fs.createReadStream("data/image-ref-registrations.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      // Filter out all children associated with the email
      const matchedEntries = results.filter(
        (entry) =>
          entry.Email.trim().toLowerCase() === email.trim().toLowerCase()
      );

      if (matchedEntries.length > 0) {
        // If there are multiple children, return all of them along with their submission status
        const children = matchedEntries.map((entry) => ({
          childName: entry["Child Name"],
          age: entry["Age"],
          status: entry["Submission-Status"],
        }));

        const pendingEntries = children.filter(
          (child) => child.status === "Pending"
        );

        // Logging all child names and ages
        const childrenLog = children
          .map((child) => `${child.childName} (Age: ${child.age})`)
          .join(", ");
        console.log(`Email registered successfully, Children: ${childrenLog}`);

        if (pendingEntries.length === 0) {
          // If all children have "Done" status, prevent further uploads
          res.json({
            success: false,
            message:
              "Looks like a submission has already been made for this email ID.",
          });
        } else {
          res.json({ success: true, children });
        }
      } else {
        res.json({
          success: false,
          message:
            "Email not found. \nPlease check your email (Use the same email you used to register)",
        });
      }
    });
});

// Endpoint to upload image with age information
app.post("/upload-image", (req, res) => {
  upload.single("file")(req, res, function (err) {
    if (req.file) {
      console.log(
        `File upload attempted: Name: ${req.file.originalname}, Size: ${req.file.size} bytes, Type: ${req.file.mimetype}`
      );
    } else {
      console.log("No file uploaded.");
    }
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: err.message });
    } else if (err) {
      return res
        .status(500)
        .json({ error: "An error occurred during the upload." });
    }

    const childName = req.body.childName;
    const emailID = req.body.email;
    const age = parseInt(req.body.age, 10);
    let categoryDir = "public/uploads";

    console.log("Email ID received:", emailID);

    // Determine the category based on the age
    if (age >= 5 && age <= 8) {
      categoryDir = "public/uploads/category1";
    } else if (age >= 9 && age <= 12) {
      categoryDir = "public/uploads/category2";
    } else if (age >= 13 && age <= 15) {
      categoryDir = "public/uploads/category3";
    }

    console.log(
      `Calculated category group based on age ${age}: ${categoryDir}`
    );
    console.log(`Age: ${age} mapped to category directory: ${categoryDir}`);

    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const fileExtension = path.extname(req.file.originalname);
    const newFileName = `${childName} - ${emailID}${fileExtension}`;
    const oldPath = req.file.path;
    const newPath = path.join(__dirname, categoryDir, newFileName);

    fs.rename(oldPath, newPath, function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to move the file." });
      }

      console.log(`File saved in Render storage at ${newPath}`);
      console.log(`Upload successful: ${newPath}`);

      // Initiate Google Drive upload in the background
      (async () => {
        try {
          const auth = authorizeServiceAccount();
          await uploadToDrive(auth, newPath, newFileName);
          console.log(`File uploaded to Google Drive: ${newFileName}`);
        } catch (error) {
          console.error("Error uploading to Google Drive:", error.message);
        }
      })();

      // Continue with CSV update
      const results = [];
      fs.createReadStream("data/image-ref-registrations.csv")
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => {
          const updatedResults = results.map((entry) => {
            if (
              entry["Child Name"].trim().toLowerCase() ===
              childName.trim().toLowerCase()
            ) {
              return { ...entry, "Submission-Status": "Done" };
            }
            return entry;
          });

          updateCSV(updatedResults)
            .then(() => {
              console.log(
                "CSV updated successfully. Submission status set to 'Done'."
              );
              console.log("Upload process completed successfully.");

              // Send response after CSV update is done, ensuring it’s only called once
              if (!res.headersSent) {
                res.status(200).json({ success: true });
              }
            })
            .catch((error) => {
              console.error("Failed to update submission status:", error);
              if (!res.headersSent) {
                res
                  .status(500)
                  .json({ error: "Failed to update submission status." });
              }
            });
        });
    });
  });
});

// Admin page for viewing gallery with category selection
app.get("/admin-little-artist-submissions", (req, res) => {
  const ageGroup = req.query.ageGroup || "category1"; // Default to category1 if no age group is selected
  const uploadDir = path.join(__dirname, `public/uploads/${ageGroup}`);

  // Read the uploads directory and get a list of all images
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).send("Error loading images");
    }

    const imageFiles = files.filter(
      (file) =>
        file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")
    );

    const imagesWithCaptions = imageFiles.map((file) => {
      const [childNameEmail, extension] = file.split(".");
      const [childName, emailID] = childNameEmail.split("-"); // Split filename to get childName and emailID

      // Format the caption
      const caption = `Painted by ${childName}, Email: ${emailID}`;

      return { file, caption };
    });

    res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Admin - Little Artist Submissions</title>
                <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Open Sans', sans-serif;
                        background-color: #f7f7f7;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    h1 {
                        color: #4a90e2;
                        margin-top: 20px;
                        position: sticky;
                        top: 0;
                        background-color: white;
                        padding: 10px 0;
                        width: 100%;
                        text-align: center;
                        z-index: 999;
                    }
                    .gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        padding: 20px;
                        width: 90%;
                    }
                    .gallery-item {
                        text-align: center;
                    }
                    .gallery img {
                        width: 100%;
                        height: auto;
                        border: 2px solid #ddd;
                        border-radius: 10px;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                        cursor: pointer;
                    }
                    .caption {
                        margin-top: 5px;
                        font-size: 14px;
                        color: #333;
                    }
                    /* Modal styles */
                    .modal {
                        display: none;
                        position: fixed;
                        z-index: 1000;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.8);
                        justify-content: center;
                        align-items: center;
                    }
                    .modal-content {
                        position: relative;
                        max-width: 90%;
                        max-height: 90%;
                        background-color: #fff;
                        padding: 10px;
                        border-radius: 10px;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                    }
                    .modal-content img {
                        max-width: 100%;
                        max-height: 100%;
                    }
                    /* Close button */
                    .close-btn {
                        position: absolute;
                        top: 10px;
                        right: 20px;
                        font-size: 24px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    /* Sticky dropdown container */
                    .dropdown-container {
                        position: sticky;
                        top: 60px; /* Adjust this based on the height of the title */
                        background-color: white;
                        z-index: 999;
                        padding: 20px;
                        width: 90%;
                        text-align: center;
                    }
                    select {
                        padding: 10px;
                        font-size: 16px;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <h1>Little Artist - Art Gallery</h1>
                <div class="dropdown-container">
                    <label for="ageGroup">Select Age Group: </label>
                    <select id="ageGroup" onchange="window.location.href='?ageGroup='+this.value">
                        <option value="category1" ${
                          ageGroup === "category1" ? "selected" : ""
                        }>Age Group 5-8</option>
                        <option value="category2" ${
                          ageGroup === "category2" ? "selected" : ""
                        }>Age Group 9-12</option>
                        <option value="category3" ${
                          ageGroup === "category3" ? "selected" : ""
                        }>Age Group 13-15</option>
                    </select>
                </div>
                <div class="gallery">
                    ${imagesWithCaptions
                      .map(
                        (image) => `
                        <div class="gallery-item">
                            <img src="/uploads/${ageGroup}/${image.file}" alt="Uploaded Image" onclick="openModal(this.src)">
                            <div class="caption">${image.caption}</div>
                        </div>
                    `
                      )
                      .join("")}
                </div>

                <!-- Modal for enlarged image -->
                <div id="imageModal" class="modal" onclick="closeModal(event)">
                    <span class="close-btn" onclick="closeModal(event)">×</span>
                    <div class="modal-content">
                        <img id="modalImage" src="" alt="Enlarged Image">
                    </div>
                </div>

                <script>
                    // Function to open the modal and display the image
                    function openModal(imageSrc) {
                        const modal = document.getElementById("imageModal");
                        const modalImage = document.getElementById("modalImage");
                        modal.style.display = "flex";
                        modalImage.src = imageSrc;
                    }

                    // Function to close the modal
                    function closeModal(event) {
                        const modal = document.getElementById("imageModal");

                        // Close modal if close button or outside area is clicked
                        if (event.target.classList.contains("modal") || event.target.classList.contains("close-btn")) {
                            modal.style.display = "none";
                        }
                    }
                </script>
            </body>
            </html>


        `);
  });
});

app.get("/admin-little-artist-submissions-table", (req, res) => {
  const results = [];

  // Read the CSV file
  fs.createReadStream("data/image-ref-registrations.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      // Initial unsorted table rows
      let tableRows = results
        .map(
          (row) => `
          <tr>
            <td>${row["Child Name"]}</td>
            <td>${row["Parent Name"]}</td>
            <td>${row["Date of Birth"]}</td>
            <td>${row["Age"]}</td>
            <td>${row["Gender"]}</td>
            <td>${row["Education Board"]}</td>
            <td>${row["Grade"]}</td>
            <td>${row["Section"]}</td>
            <td>${row["Country Code"]}</td>
            <td>${row["Phone Number"]}</td>
            <td>${row["Email"]}</td>
            <td>${row["Registration ID"]}</td>
            <td>${row["Submission-Status"]}</td>
          </tr>`
        )
        .join("");

      // Send the full HTML page with a sort feature
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CSV Data - Little Artist Submissions</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            table, th, td {
              border: 1px solid black;
            }
            th, td {
              padding: 10px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              cursor: pointer;
            }
            th:hover {
              background-color: #e2e2e2;
            }
          </style>
        </head>
        <body>
          <h1>Little Artist Submissions - CSV Data</h1>
          <table id="csvTable">
            <thead>
              <tr>
                <th>Child Name</th>
                <th>Parent Name</th>
                <th>Date of Birth</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Education Board</th>
                <th>Grade</th>
                <th>Section</th>
                <th>Country Code</th>
                <th>Phone Number</th>
                <th>Email</th>
                <th>Registration ID</th>
                <th onclick="sortTable()">Submission Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            let sortDirection = true; // true = ascending, false = descending

            function sortTable() {
              const table = document.getElementById('csvTable').tBodies[0];
              const rows = Array.from(table.rows);

              rows.sort((rowA, rowB) => {
                const statusA = rowA.cells[12].innerText.toLowerCase();
                const statusB = rowB.cells[12].innerText.toLowerCase();

                if (sortDirection) {
                  return statusA.localeCompare(statusB); // Ascending
                } else {
                  return statusB.localeCompare(statusA); // Descending
                }
              });

              // Re-append rows in the sorted order
              rows.forEach(row => table.appendChild(row));

              // Toggle the sort direction for the next click
              sortDirection = !sortDirection;
            }
          </script>
        </body>
        </html>
      `);
    });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

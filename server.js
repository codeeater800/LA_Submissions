const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 3000;

let latestAgeCategory = null; // Store the latest category based on age

// Middleware to serve static files
app.use(express.static("public"));
app.use(express.json()); // To handle JSON form data
app.use(express.urlencoded({ extended: true })); // Middleware to handle non-file form data

// Set up Multer for file uploads with categorized directories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let categoryDir = "public/uploads";

    // Set directory based on the previously saved age category
    if (latestAgeCategory === "category1") {
      categoryDir = "public/uploads/category1";
    } else if (latestAgeCategory === "category2") {
      categoryDir = "public/uploads/category2";
    } else if (latestAgeCategory === "category3") {
      categoryDir = "public/uploads/category3";
    }

    // Ensure the directory exists before saving the file
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    cb(null, categoryDir);
  },
  filename: (req, file, cb) => {
    const uniqueNumber = Date.now();
    const fileName = `${uniqueNumber}${path.extname(file.originalname)}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });

// Endpoint to check email and fetch child's name and age
app.get("/check-email", (req, res) => {
  const email = req.query.email;
  let registrationFound = false;

  const results = [];
  fs.createReadStream("data/image-ref-registrations.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      const matchedEntries = results.filter(
        (entry) =>
          entry.Email.trim().toLowerCase() === email.trim().toLowerCase()
      );
      if (matchedEntries.length > 0) {
        registrationFound = true;
        const childName = matchedEntries[0]["Child Name"];
        const age = matchedEntries[0]["Age"]; // Fetch the age as well
        res.json({ success: true, childName, age });
      } else {
        res.json({
          success: false,
          message: "Email not used to register, please try again.",
        });
      }
    });
});

// Endpoint to upload image with age information
app.post("/upload-image", (req, res) => {
  upload.single("file")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: err.message });
    } else if (err) {
      return res
        .status(500)
        .json({ error: "An error occurred during the upload." });
    }

    console.log("Request body:", req.body); // Log the entire body to see what fields are received
    const age = parseInt(req.body.age, 10); // Get age from the form data
    console.log("Received age:", age);

    if (isNaN(age)) {
      return res.status(400).json({ error: "Invalid age provided" });
    }

    res.status(200).json({ success: true });
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
        file.endsWith(".png") ||
        file.endsWith(".jpg") ||
        file.endsWith(".jpeg") ||
        file.endsWith(".gif")
    );

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
                    }
                    .caption {
                        margin-top: 5px;
                        font-size: 14px;
                        color: #333;
                    }
                    .dropdown-container {
                        position: sticky;
                        top: 0;
                        background-color: white;
                        z-index: 1;
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
                    ${imageFiles
                      .map(
                        (file) => `
                        <div class="gallery-item">
                            <img src="/uploads/${ageGroup}/${file}" alt="Uploaded Image">
                            <div class="caption">${file}</div>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </body>
            </html>
        `);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve static files
app.use(express.static("public"));

// Set up Multer for file uploads, will dynamically rename file using child's name
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    const email = req.body.email; // Expect email to be sent with the file upload form
    let childName = "";

    // Read the CSV to find the child's name associated with the email
    fs.createReadStream("data/image-ref-registrations.csv")
      .pipe(csv())
      .on("data", (data) => {
        console.log(data); // Log the data to ensure the CSV is being read correctly
        console.log(`Email in CSV: ${data.Email}`);
        console.log(`Email being checked: ${email}`);

        // Use trim and toLowerCase for case-insensitive and whitespace-tolerant comparison
        if (data.Email.trim().toLowerCase() === email.trim().toLowerCase()) {
          childName = data["Child Name"];
        }
      })
      .on("end", () => {
        if (childName) {
          const safeChildName = childName.replace(/\s+/g, "_");
          const fileName = `Painted_by_${safeChildName}${path.extname(
            file.originalname
          )}`;
          cb(null, fileName);
        } else {
          cb(new Error("Child name not found"));
        }
      });
  },
});
const upload = multer({ storage, limits: { fileSize: 4 * 1024 * 1024 } });

// Endpoint to check email in CSV
app.get("/check-email", (req, res) => {
  const email = req.query.email;
  let registrationFound = false;

  const results = [];
  fs.createReadStream("data/image-ref-registrations.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      const matchedEntries = results.filter((entry) => entry.Email === email);
      if (matchedEntries.length > 0) {
        registrationFound = true;
        res.json({ success: true, childName: matchedEntries[0]["Child Name"] });
      } else {
        res.json({
          success: false,
          message: "Email not used to register, please try again.",
        });
      }
    });
});

// Endpoint to upload image
app.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No file uploaded or file is too large." });
  }
  res.status(200).json({ success: true });
});

// Updated admin page route to display filenames as captions
app.get("/admin-little-artist-submissions", (req, res) => {
  const uploadDir = path.join(__dirname, "public/uploads");

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
                </style>
            </head>
            <body>
                <h1>Little Artist - Art Gallery</h1>
                <div class="gallery">
                    ${imageFiles
                      .map(
                        (file) => `
                        <div class="gallery-item">
                            <img src="/uploads/${file}" alt="Uploaded Image">
                            <div class="caption">${file
                              .replace(/_/g, " ")
                              .replace(/\.[^/.]+$/, "")}</div>
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

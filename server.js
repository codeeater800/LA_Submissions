const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = 3000;

// Middleware to serve static files
app.use(express.static("public"));

// Set up Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

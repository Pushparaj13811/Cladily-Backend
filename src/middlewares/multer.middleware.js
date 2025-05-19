import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`Created temp directory at: ${tempDir}`);
}

// Configure Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const filename = file.fieldname + "-" + uniqueSuffix + ext;
        console.log(`Generated filename for ${file.originalname}: ${filename}`);
        cb(null, filename);
    },
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    console.log(`Checking file type for ${file.originalname}: ${file.mimetype}`);
    
    if (allowedTypes.includes(file.mimetype)) {
        console.log(`File ${file.originalname} accepted`);
        cb(null, true);
    } else {
        console.log(`File ${file.originalname} rejected: Invalid type ${file.mimetype}`);
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

// Multer instance with configuration
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 10 // Maximum 10 files
    }
}).fields([
    { name: 'images', maxCount: 10 }
]);

// Middleware to handle file uploads
const handleFileUpload = (req, res, next) => {
    console.log('Starting file upload process...');
    console.log('Request headers:', req.headers);
    
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            // A Multer error occurred when uploading
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size too large. Maximum size is 5MB.'
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    success: false,
                    message: 'Too many files. Maximum is 10 files.'
                });
            }
            return res.status(400).json({
                success: false,
                message: `Upload error: ${err.message}`
            });
        } else if (err) {
            console.error('Unknown error during upload:', err);
            // An unknown error occurred
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        // Process uploaded files
        if (req.files) {
            console.log('Files received:', Object.keys(req.files));
            Object.entries(req.files).forEach(([fieldname, files]) => {
                console.log(`Field ${fieldname} received ${files.length} files:`);
                files.forEach(file => {
                    console.log(`- ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
                    console.log(`  Path: ${file.path}`);
                });
            });
        } else {
            console.log('No files were uploaded');
        }

        next();
    });
};

// Middleware to handle dynamic fields
const handleDynamicFields = (req, res, next) => {
    // Parse JSON strings in the request body
    const fieldsToParse = ['care', 'features', 'sizes', 'colors', 'variants'];
    
    fieldsToParse.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
            try {
                req.body[field] = JSON.parse(req.body[field]);
            } catch (error) {
                console.warn(`Failed to parse ${field} field:`, error);
            }
        }
    });

    next();
};

export { handleFileUpload, handleDynamicFields, upload };

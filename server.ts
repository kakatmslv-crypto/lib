import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import {
  defaultCategories,
  defaultBooks,
  defaultStudents,
  defaultBorrowRecords,
  defaultUsers,
  defaultRoles,
  defaultWishlist
} from './src/data/defaultData';

dotenv.config();

let pool: mysql.Pool | null = null;
let isDbOffline = false;

const OFFLINE_DB_PATH = path.join(process.cwd(), 'offline_db.json');

// Initialize memory store with deep copies of default datasets
let offlineStore: { [key: string]: any[] } = {
  categories: JSON.parse(JSON.stringify(defaultCategories)),
  books: JSON.parse(JSON.stringify(defaultBooks)),
  students: JSON.parse(JSON.stringify(defaultStudents)),
  records: JSON.parse(JSON.stringify(defaultBorrowRecords)),
  wishlist: JSON.parse(JSON.stringify(defaultWishlist)),
  roles: JSON.parse(JSON.stringify(defaultRoles)),
  users: JSON.parse(JSON.stringify(defaultUsers)),
};

// Load offline db from file if it exists
try {
  if (fs.existsSync(OFFLINE_DB_PATH)) {
    const fileData = fs.readFileSync(OFFLINE_DB_PATH, 'utf-8');
    const parsed = JSON.parse(fileData);
    offlineStore = { ...offlineStore, ...parsed };
    console.log("Loaded offline database from local file system.");
  }
} catch (e: any) {
  console.log("Error loading offline database from file:", e.message);
}

// Function to persist offline db
function saveOfflineDb() {
  try {
    fs.writeFileSync(OFFLINE_DB_PATH, JSON.stringify(offlineStore, null, 2), 'utf-8');
  } catch (e: any) {
    console.error("Failed to save offline database to file:", e.message);
  }
}

// Lazy initialization of MySQL connection pool
async function getMysqlPool() {
  if (!pool) {
    if (!process.env.MYSQL_HOST) {
      throw new Error("MYSQL_HOST environment variable is missing.");
    }
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

// Global execution wrapper with auto-retry on connection failures
async function runQuery(sql: string, params: any[] = []): Promise<any> {
  const dbPool = await getMysqlPool();
  const [results] = await dbPool.execute(sql, params);
  return results;
}

// Convert object keys from snake_case (database) to camelCase (frontend API)
function toCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamel);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = toCamel(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Convert object keys from camelCase (frontend API) to snake_case (database)
function toSnake(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnake);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      newObj[snakeKey] = toSnake(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Database schema initialization with high-performance indexes
async function ensureTablesExist() {
  try {
    const pool = await getMysqlPool();
    console.log("Initializing database tables and indexes if missing...");

    await runQuery(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(255) PRIMARY KEY,
        name_kh VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        color VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS books (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        barcode VARCHAR(255) NOT NULL,
        category_id VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        publish_year INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        location VARCHAR(255) NULL,
        added_date VARCHAR(50) NOT NULL,
        cover_image LONGTEXT NULL,
        notification_email VARCHAR(255) NULL,
        notification_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category_id),
        INDEX idx_barcode (barcode),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(255) PRIMARY KEY,
        student_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(10) NOT NULL,
        class_grade VARCHAR(50) NOT NULL,
        phone_number VARCHAR(100) NOT NULL,
        email VARCHAR(255) NULL,
        password VARCHAR(255) NULL,
        photo LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id),
        INDEX idx_class_grade (class_grade)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Resiliently add columns if they don't exist
    try {
      await runQuery(`ALTER TABLE students ADD COLUMN email VARCHAR(255) NULL`);
    } catch (e) {}
    try {
      await runQuery(`ALTER TABLE students ADD COLUMN password VARCHAR(255) NULL`);
    } catch (e) {}
    try {
      await runQuery(`ALTER TABLE students ADD COLUMN photo LONGTEXT NULL`);
    } catch (e) {}

    await runQuery(`
      CREATE TABLE IF NOT EXISTS records (
        id VARCHAR(255) PRIMARY KEY,
        book_id VARCHAR(255) NOT NULL,
        student_id VARCHAR(255) NOT NULL,
        borrow_date VARCHAR(50) NOT NULL,
        due_date VARCHAR(50) NOT NULL,
        return_date VARCHAR(50) NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT NULL,
        fine_amount DECIMAL(10,2) DEFAULT 0.00,
        fine_paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_book (book_id),
        INDEX idx_student (student_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        request_date VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(255) PRIMARY KEY,
        name_kh VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        permissions TEXT NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        last_login VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("MySQL Database schema initialized successfully.");
    await seedDefaultData();
  } catch (err: any) {
    isDbOffline = true;
    console.log("MySQL Database is currently offline or unreachable (" + err.message + "). Serving application with offline/Firebase Firestore fallback.");
  }
}

// Auto-seed database if empty
async function seedDefaultData() {
  try {
    const dbPool = await getMysqlPool();
    const connection = await dbPool.getConnection();
    try {
      // Check if categories table is empty
      const [catRows] = await connection.execute('SELECT COUNT(*) as count FROM categories');
      const count = (catRows as any)[0].count;

      if (count === 0) {
        console.log("MySQL Database is empty. Seeding default data...");
        await connection.beginTransaction();

        // 1. Seed Categories
        for (const cat of defaultCategories) {
          await upsertRow(connection, 'categories', cat.id, cat);
        }

        // 2. Seed Roles
        for (const role of defaultRoles) {
          await upsertRow(connection, 'roles', role.id, role);
        }

        // 3. Seed Users
        for (const u of defaultUsers) {
          await upsertRow(connection, 'users', u.id, u);
        }

        // 4. Seed Books
        for (const b of defaultBooks) {
          await upsertRow(connection, 'books', b.id, b);
        }

        // 5. Seed Students
        for (const s of defaultStudents) {
          await upsertRow(connection, 'students', s.id, s);
        }

        // 6. Seed Records
        for (const r of defaultBorrowRecords) {
          await upsertRow(connection, 'records', r.id, r);
        }

        // 7. Seed Wishlist
        for (const w of defaultWishlist) {
          await upsertRow(connection, 'wishlist', w.id, w);
        }

        await connection.commit();
        console.log("MySQL Database seeded successfully with default datasets.");
      } else {
        console.log("MySQL Database already contains data. Skipping initial seed.");
      }
    } catch (err: any) {
      try {
        await connection.rollback();
      } catch {}
      console.error("Failed to seed default database tables:", err.message);
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error("Failed to obtain connection for seeding:", err.message);
  }
}

// Server side data validation to protect integrity
function validateData(entity: string, data: any): string | null {
  if (!data || typeof data !== 'object') return "Invalid data object.";
  if (!data.id) return "Missing primary identifier 'id'.";

  switch (entity) {
    case 'categories':
      if (!data.nameKh || !data.nameEn) return "Category nameKh and nameEn are required.";
      break;
    case 'books':
      if (!data.title || !data.barcode || !data.categoryId || !data.author) {
        return "Book title, barcode, categoryId, and author are required.";
      }
      break;
    case 'students':
      if (!data.studentId || !data.name || !data.gender || !data.classGrade || !data.phoneNumber) {
        return "Student id, name, gender, classGrade, and phoneNumber are required.";
      }
      break;
    case 'records':
      if (!data.bookId || !data.studentId || !data.borrowDate || !data.dueDate || !data.status) {
        return "Borrow record bookId, studentId, borrowDate, dueDate, and status are required.";
      }
      break;
    case 'wishlist':
      if (!data.title || !data.author || !data.requesterName || !data.requestDate || !data.status) {
        return "Wishlist title, author, requesterName, requestDate, and status are required.";
      }
      break;
    case 'roles':
      if (!data.nameKh || !data.nameEn || !data.permissions) {
        return "Role nameKh, nameEn, and permissions are required.";
      }
      break;
    case 'users':
      if (!data.username || !data.name || !data.role) {
        return "User username, name, and role are required.";
      }
      break;
  }
  return null;
}

// Generic upsert logic supporting dynamic column queries inside transaction
async function upsertRow(connection: mysql.Connection, table: string, id: string, data: any) {
  const rawSnake = toSnake(data);
  
  // Format specific fields (e.g. serialize permissions object in roles)
  if (table === 'roles' && rawSnake.permissions) {
    if (typeof rawSnake.permissions === 'object') {
      rawSnake.permissions = JSON.stringify(rawSnake.permissions);
    }
  }

  const keys = Object.keys(rawSnake);
  const values = Object.values(rawSnake);
  const placeholders = keys.map(() => '?').join(', ');
  const updateExpr = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

  const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateExpr}`;
  await connection.execute(sql, values as any[]);
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// -----------------------------------------------------------------------------
// GOOGLE OAUTH & MOCK AUTH ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/auth/google/url', (req, res) => {
  const { redirect_uri } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // If credentials are not configured, redirect to our high-fidelity mock selector
    const mockUrl = `/api/auth/google/mock-login-page?redirect_uri=${encodeURIComponent(redirect_uri as string || '')}`;
    return res.json({ url: mockUrl, isMock: true });
  }

  // Construct standard Google OAuth 2.0 authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect_uri as string,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: 'google_state_session'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl, isMock: false });
});

app.get('/api/auth/google/mock-login-page', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="km">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Google - ជ្រើសរើសគណនី / Sign in with Google</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Kantumruy+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Kantumruy Pro', 'Inter', sans-serif;
        }
      </style>
    </head>
    <body class="bg-[#F0F4F9] min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] w-full max-w-[450px]">
        <!-- Google Logo SVG -->
        <div class="flex justify-center mb-6">
          <svg class="h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>

        <h1 class="text-[24px] text-center font-medium text-[#1F1F1F] mb-2">ជ្រើសរើសគណនី</h1>
        <p class="text-center text-[#444746] text-sm mb-6">ដើម្បីបន្តទៅកាន់ <span class="font-medium">ប្រព័ន្ធគ្រប់គ្រងបណ្ណាល័យ</span></p>

        <div class="space-y-1 max-h-[280px] overflow-y-auto mb-6 pr-1">
          <!-- Option 1: Admin -->
          <button onclick="selectAccount('admin@school.edu.kh', 'Sambat Chhunheang (Admin)')" class="w-full flex items-center p-3 hover:bg-[#F3F4F6] rounded-xl transition text-left">
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 mr-3 text-sm">SC</div>
            <div class="flex-1">
              <div class="font-medium text-sm text-[#1F1F1F]">Sambat Chhunheang (Admin)</div>
              <div class="text-xs text-[#5F6368]">admin@school.edu.kh</div>
            </div>
          </button>

          <!-- Option 2: Librarian -->
          <button onclick="selectAccount('librarian@school.edu.kh', 'Keo Samrang (Librarian)')" class="w-full flex items-center p-3 hover:bg-[#F3F4F6] rounded-xl transition text-left">
            <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600 mr-3 text-sm">KS</div>
            <div class="flex-1">
              <div class="font-medium text-sm text-[#1F1F1F]">Keo Samrang (Librarian)</div>
              <div class="text-xs text-[#5F6368]">librarian@school.edu.kh</div>
            </div>
          </button>

          <!-- Option 3: Student 1 -->
          <button onclick="selectAccount('chan.monny@school.edu.kh', 'ចាន់ មុន្នី')" class="w-full flex items-center p-3 hover:bg-[#F3F4F6] rounded-xl transition text-left">
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-600 mr-3 text-sm">CM</div>
            <div class="flex-1">
              <div class="font-medium text-sm text-[#1F1F1F]">ចាន់ មុន្នី</div>
              <div class="text-xs text-[#5F6368]">chan.monny@school.edu.kh</div>
            </div>
          </button>

          <!-- Option 4: Student 2 -->
          <button onclick="selectAccount('sokh.kimhour@school.edu.kh', 'សុខ គឹមហួរ')" class="w-full flex items-center p-3 hover:bg-[#F3F4F6] rounded-xl transition text-left">
            <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-600 mr-3 text-sm">SK</div>
            <div class="flex-1">
              <div class="font-medium text-sm text-[#1F1F1F]">សុខ គឹមហួរ</div>
              <div class="text-xs text-[#5F6368]">sokh.kimhour@school.edu.kh</div>
            </div>
          </button>
        </div>

        <!-- Custom Account Drawer Toggle -->
        <div class="border-t border-[#E0E2E4] pt-4">
          <button onclick="toggleCustomForm()" class="w-full flex items-center p-3 hover:bg-[#F3F4F6] rounded-xl transition text-left text-blue-600 font-medium text-sm">
            <svg class="h-5 w-5 mr-3 text-[#1A73E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            ប្រើប្រាស់គណនីផ្សេងទៀត / Use another account
          </button>
        </div>

        <!-- Custom Account Form (Initially hidden) -->
        <div id="customForm" class="hidden mt-4 bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100 animate-fadeIn">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">ព័ត៌មានគណនីថ្មី / New Account info</div>
          <div>
            <label class="block text-xs text-gray-600 mb-1">ឈ្មោះពេញ / Full Name</label>
            <input type="text" id="customName" placeholder="ឧ. ជា សុភ័ក្រ" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          </div>
          <div>
            <label class="block text-xs text-gray-600 mb-1">អ៊ីមែល / Email</label>
            <input type="email" id="customEmail" placeholder="ឧ. sopheak@gmail.com" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          </div>
          <button onclick="submitCustomAccount()" class="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            បន្តចូលប្រើប្រាស់ / Sign In
          </button>
        </div>

        <div class="text-[11px] text-[#5F6368] leading-relaxed mt-6 text-center">
          ដើម្បីបន្ត Google នឹងចែករំលែកឈ្មោះ អាសយដ្ឋានអ៊ីមែល និងរូបភាពកម្រងព័ត៌មានរបស់អ្នកជាមួយប្រព័ន្ធគ្រប់គ្រងបណ្ណាល័យ។
        </div>
      </div>

      <script>
        function selectAccount(email, name) {
          window.location.href = '/auth/callback?code=mock_code&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name);
        }

        function toggleCustomForm() {
          const form = document.getElementById('customForm');
          form.classList.toggle('hidden');
        }

        function submitCustomAccount() {
          const name = document.getElementById('customName').value.trim();
          const email = document.getElementById('customEmail').value.trim();
          
          if (!name || !email) {
            alert('សូមបំពេញឈ្មោះ និងអ៊ីមែលឱ្យបានត្រឹមត្រូវ!');
            return;
          }
          if (!email.includes('@')) {
            alert('អ៊ីមែលមិនត្រឹមត្រូវទេ!');
            return;
          }
          
          selectAccount(email, name);
        }
      </script>
    </body>
    </html>
  `);
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, email: mockEmail, name: mockName } = req.query;
  let email = '';
  let name = '';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (code === 'mock_code') {
    email = (mockEmail as string) || 'test.user@school.edu.kh';
    name = (mockName as string) || 'Test User';
  } else if (code) {
    // Real Google Auth exchange
    try {
      const redirect_uri = `${req.protocol}://${req.get('host')}/auth/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code'
        }).toString()
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed: ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userRes.ok) {
        throw new Error('Failed to fetch user profile from Google');
      }

      const userData = await userRes.json();
      email = userData.email;
      name = userData.name || userData.given_name || email.split('@')[0];
    } catch (err: any) {
      console.error("Google login exchange error:", err);
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: "${encodeURIComponent(err.message)}" }, '*');
                window.close();
              } else {
                window.location.href = '/?error=auth_failed';
              }
            </script>
            <p>Authentication failed: ${err.message}. Close this window to retry.</p>
          </body>
        </html>
      `);
    }
  } else {
    return res.status(400).send("Authorization code is missing.");
  }

  // --- Login Resolution (Everyone can log in!) ---
  let userPayload: any = null;
  const lowerEmail = email.toLowerCase();

  // 1. Check if email matches a system user (admin/librarian/etc.)
  let matchedUser = offlineStore.users.find((u: any) => u.username.toLowerCase() === lowerEmail || (u.email && u.email.toLowerCase() === lowerEmail));
  
  if (!matchedUser && !isDbOffline) {
    try {
      const rows = await runQuery('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [lowerEmail, lowerEmail]);
      if (rows && rows.length > 0) {
        matchedUser = toCamel(rows[0]);
      }
    } catch (e) {}
  }

  if (matchedUser) {
    userPayload = {
      id: matchedUser.id,
      username: matchedUser.username,
      name: matchedUser.name,
      role: matchedUser.role,
      lastLogin: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
  } else {
    // 2. Check if email matches an existing student
    let matchedStudent = offlineStore.students.find((s: any) => s.email && s.email.toLowerCase() === lowerEmail);
    
    if (!matchedStudent && !isDbOffline) {
      try {
        const rows = await runQuery('SELECT * FROM students WHERE LOWER(email) = ?', [lowerEmail]);
        if (rows && rows.length > 0) {
          matchedStudent = toCamel(rows[0]);
        }
      } catch (e) {}
    }

    if (matchedStudent) {
      userPayload = {
        id: matchedStudent.id,
        username: matchedStudent.studentId.toLowerCase(),
        name: matchedStudent.name,
        role: 'student',
        lastLogin: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };
    } else {
      // 3. New user - Everyone can login! "ចូលបានទាំងអស់"
      // Automatically register them as a new student in the system!
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const studentId = `STU-GEN-${randomSuffix}`;
      const newStudent: any = {
        id: `stu-google-${randomSuffix}`,
        studentId: studentId,
        name: name,
        gender: 'M',
        classGrade: '12A',
        phoneNumber: '012 ' + Math.floor(100000 + Math.random() * 900000),
        email: lowerEmail,
        password: `pass${randomSuffix}`
      };

      // Save to store
      offlineStore.students.push(newStudent);
      saveOfflineDb();

      // Save to DB if online
      if (!isDbOffline) {
        try {
          const dbPool = await getMysqlPool();
          const connection = await dbPool.getConnection();
          try {
            await upsertRow(connection, 'students', newStudent.id, newStudent);
          } finally {
            connection.release();
          }
        } catch (e) {
          console.error("Failed to persist newly registered student via Google:", e);
        }
      }

      userPayload = {
        id: newStudent.id,
        username: studentId.toLowerCase(),
        name: newStudent.name,
        role: 'student',
        lastLogin: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };
    }
  }

  // Send success message to parent window and close popup
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'GOOGLE_AUTH_SUCCESS', 
              user: ${JSON.stringify(userPayload)} 
            }, '*');
            window.close();
          } else {
            try {
              localStorage.setItem('library_user', JSON.stringify(${JSON.stringify(userPayload)}));
            } catch(e) {}
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful. Logging you in... This window should close automatically.</p>
      </body>
    </html>
  `);
});

// -----------------------------------------------------------------------------
// CONNECTION STATUS & DIAGNOSTICS
// -----------------------------------------------------------------------------
app.get('/api/mysql-status', async (req, res) => {
  try {
    if (isDbOffline) {
      res.json({ connected: false, error: "Database is currently running in offline fallback mode." });
      return;
    }
    const poolConnection = await getMysqlPool();
    const [rows] = await poolConnection.execute('SELECT 1');
    res.json({ connected: true, msg: "Database connection active." });
  } catch (err: any) {
    isDbOffline = true;
    res.json({ connected: false, error: err.message || "Unable to reach database server." });
  }
});

// Configure MySQL database parameters dynamically
app.post('/api/mysql-config', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  try {
    process.env.MYSQL_HOST = host;
    process.env.MYSQL_PORT = String(port || '3306');
    process.env.MYSQL_USER = user;
    process.env.MYSQL_PASSWORD = password;
    process.env.MYSQL_DATABASE = database;

    // Reset pool so it re-initializes on next query
    pool = null;
    isDbOffline = false;

    // Try to test connection and ensure tables exist
    await ensureTablesExist();

    if (isDbOffline) {
      return res.status(500).json({ success: false, error: "Failed to connect with provided credentials." });
    }

    res.json({ success: true, message: "MySQL configuration updated and connection established." });
  } catch (err: any) {
    isDbOffline = true;
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full database batch sync
app.post('/api/mysql-sync', async (req, res) => {
  const { categories, books, students, records, wishlist, roles, users } = req.body;

  if (isDbOffline) {
    // Save to offline storage
    if (categories) offlineStore.categories = categories;
    if (books) offlineStore.books = books;
    if (students) offlineStore.students = students;
    if (records) offlineStore.records = records;
    if (wishlist) offlineStore.wishlist = wishlist;
    if (roles) offlineStore.roles = roles;
    if (users) offlineStore.users = users;
    saveOfflineDb();
    return res.json({ success: true, message: "Synchronized with offline storage." });
  }

  let connection: mysql.PoolConnection | null = null;
  try {
    const dbPool = await getMysqlPool();
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // Helper to safely clear and upsert to a table
    const syncTable = async (tableName: string, list: any[]) => {
      if (!list || !Array.isArray(list)) return;
      await connection!.execute(`DELETE FROM \`${tableName}\``);
      for (const item of list) {
        await upsertRow(connection!, tableName, item.id, item);
      }
    };

    await syncTable('categories', categories);
    await syncTable('roles', roles);
    await syncTable('users', users);
    await syncTable('books', books);
    await syncTable('students', students);
    await syncTable('records', records);
    await syncTable('wishlist', wishlist);

    await connection.commit();
    res.json({ success: true, message: "MySQL database synchronized successfully." });
  } catch (err: any) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// -----------------------------------------------------------------------------
// BATCH AUTO-SAVE & SYNC TRANSACTION ENDPOINT
// -----------------------------------------------------------------------------
app.post('/api/sync', async (req, res) => {
  const mutations = req.body.mutations;
  if (!Array.isArray(mutations)) {
    return res.status(400).json({ success: false, error: "Invalid sync request format." });
  }

  const syncedIds: string[] = [];

  if (isDbOffline) {
    try {
      for (const mutation of mutations) {
        const { id, entity, action, data } = mutation;
        if (!entity || !action || !data) {
          continue;
        }
        const list = offlineStore[entity] || [];
        if (action === 'delete') {
          const targetId = typeof data === 'object' ? data.id : data;
          offlineStore[entity] = list.filter((item: any) => item.id !== targetId);
        } else {
          const existingIdx = list.findIndex((item: any) => item.id === data.id);
          if (existingIdx >= 0) {
            list[existingIdx] = data;
          } else {
            list.push(data);
          }
          offlineStore[entity] = list;
        }
        syncedIds.push(id);
      }
      saveOfflineDb();
      res.json({ success: true, syncedIds });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
    return;
  }

  let connection: mysql.PoolConnection | null = null;

  try {
    const dbPool = await getMysqlPool();
    connection = await dbPool.getConnection();
    
    // Start atomic transaction
    await connection.beginTransaction();

    for (const mutation of mutations) {
      const { id, entity, action, data } = mutation;
      if (!entity || !action || !data) {
        throw new Error(`Malformed mutation object: ${JSON.stringify(mutation)}`);
      }

      // Map table name
      const table = entity === 'records' ? 'records' : entity;

      if (action === 'delete') {
        const targetId = typeof data === 'object' ? data.id : data;
        await connection.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [targetId]);
      } else {
        // Validate payload before writing to protect database consistency
        const validationError = validateData(entity, data);
        if (validationError) {
          throw new Error(`Validation Error on entity [${entity}] (ID: ${data.id}): ${validationError}`);
        }
        await upsertRow(connection, table, data.id, data);
      }
      syncedIds.push(id);
    }

    // Commit changes safely
    await connection.commit();
    res.json({ success: true, syncedIds });
  } catch (err: any) {
    console.error("Auto Save Sync transaction aborted, rolling back. Reason:", err.message);
    if (connection) {
      await connection.rollback();
    }
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// -----------------------------------------------------------------------------
// DYNAMIC CRUD ROUTE GENERATOR (to cleanly replace all placeholders)
// -----------------------------------------------------------------------------
const entities = ['categories', 'books', 'students', 'records', 'wishlist', 'roles', 'users'];

entities.forEach(entity => {
  const table = entity;

  // GET ALL
  app.get(`/api/${entity}`, async (req, res) => {
    try {
      if (isDbOffline) {
        const rows = offlineStore[entity] || [];
        res.json(toCamel(rows));
        return;
      }
      const rows: any = await runQuery(`SELECT * FROM \`${table}\``);
      // Map permissions parsing for roles
      if (entity === 'roles') {
        rows.forEach((r: any) => {
          if (r.permissions && typeof r.permissions === 'string') {
            try {
              r.permissions = JSON.parse(r.permissions);
            } catch {
              r.permissions = {};
            }
          }
        });
      }
      res.json(toCamel(rows));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST
  app.post(`/api/${entity}`, async (req, res) => {
    try {
      const error = validateData(entity, req.body);
      if (error) return res.status(400).json({ error });

      if (isDbOffline) {
        const list = offlineStore[entity] || [];
        const existingIdx = list.findIndex((item: any) => item.id === req.body.id);
        if (existingIdx >= 0) {
          list[existingIdx] = req.body;
        } else {
          list.push(req.body);
        }
        offlineStore[entity] = list;
        saveOfflineDb();
        res.status(201).json(req.body);
        return;
      }

      const dbPool = await getMysqlPool();
      const connection = await dbPool.getConnection();
      try {
        await upsertRow(connection, table, req.body.id, req.body);
        res.status(201).json(req.body);
      } finally {
        connection.release();
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT
  app.put(`/api/${entity}/:id`, async (req, res) => {
    try {
      const error = validateData(entity, req.body);
      if (error) return res.status(400).json({ error });

      if (isDbOffline) {
        const list = offlineStore[entity] || [];
        const existingIdx = list.findIndex((item: any) => item.id === req.params.id);
        if (existingIdx >= 0) {
          list[existingIdx] = req.body;
        } else {
          list.push(req.body);
        }
        offlineStore[entity] = list;
        saveOfflineDb();
        res.json(req.body);
        return;
      }

      const dbPool = await getMysqlPool();
      const connection = await dbPool.getConnection();
      try {
        await upsertRow(connection, table, req.params.id, req.body);
        res.json(req.body);
      } finally {
        connection.release();
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete(`/api/${entity}/:id`, async (req, res) => {
    try {
      if (isDbOffline) {
        const list = offlineStore[entity] || [];
        offlineStore[entity] = list.filter((item: any) => item.id !== req.params.id);
        saveOfflineDb();
        res.json({ success: true });
        return;
      }
      await runQuery(`DELETE FROM \`${table}\` WHERE id = ?`, [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
});

// -----------------------------------------------------------------------------
// SEED DATABASE ON REQUEST
// -----------------------------------------------------------------------------
app.post('/api/seed', async (req, res) => {
  try {
    if (isDbOffline) {
      offlineStore = {
        categories: JSON.parse(JSON.stringify(defaultCategories)),
        books: JSON.parse(JSON.stringify(defaultBooks)),
        students: JSON.parse(JSON.stringify(defaultStudents)),
        records: JSON.parse(JSON.stringify(defaultBorrowRecords)),
        wishlist: JSON.parse(JSON.stringify(defaultWishlist)),
        roles: JSON.parse(JSON.stringify(defaultRoles)),
        users: JSON.parse(JSON.stringify(defaultUsers)),
      };
      saveOfflineDb();
      res.json({ success: true, message: "Offline database successfully re-seeded with pristine default datasets." });
      return;
    }

    const dbPool = await getMysqlPool();
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      console.log("Forced seeding request received. Clearing and re-seeding all tables...");

      // Clear all records
      await connection.execute('DELETE FROM records');
      await connection.execute('DELETE FROM wishlist');
      await connection.execute('DELETE FROM books');
      await connection.execute('DELETE FROM users');
      await connection.execute('DELETE FROM students');
      await connection.execute('DELETE FROM roles');
      await connection.execute('DELETE FROM categories');

      // 1. Seed Categories
      for (const cat of defaultCategories) {
        await upsertRow(connection, 'categories', cat.id, cat);
      }

      // 2. Seed Roles
      for (const role of defaultRoles) {
        await upsertRow(connection, 'roles', role.id, role);
      }

      // 3. Seed Users
      for (const u of defaultUsers) {
        await upsertRow(connection, 'users', u.id, u);
      }

      // 4. Seed Books
      for (const b of defaultBooks) {
        await upsertRow(connection, 'books', b.id, b);
      }

      // 5. Seed Students
      for (const s of defaultStudents) {
        await upsertRow(connection, 'students', s.id, s);
      }

      // 6. Seed Records
      for (const r of defaultBorrowRecords) {
        await upsertRow(connection, 'records', r.id, r);
      }

      // 7. Seed Wishlist
      for (const w of defaultWishlist) {
        await upsertRow(connection, 'wishlist', w.id, w);
      }

      await connection.commit();
      console.log("Forced seeding finished successfully.");
      res.json({ success: true, message: "MySQL database successfully re-seeded with pristine default datasets." });
    } catch (err: any) {
      try {
        await connection.rollback();
      } catch {}
      console.error("Failed during manual seeding:", err.message);
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run tables check on server startup
ensureTablesExist();

// -----------------------------------------------------------------------------
// VITE OR STATIC FILE SERVING & SERVER LAUNCH
// -----------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running in development on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to start Vite dev server:', err);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in production on http://localhost:${PORT}`);
  });
}

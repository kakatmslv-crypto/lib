import { Book, Category, Student, BorrowRecord, User, Role, WishlistItem } from '../types';

export const defaultCategories: Category[] = [
  { id: 'cat-kh', nameKh: 'អក្សរសាស្ត្រខ្មែរ', nameEn: 'Khmer Literature', color: '#EF4444' }, // Red/Rose
  { id: 'cat-math', nameKh: 'គណិតវិទ្យា', nameEn: 'Mathematics', color: '#3B82F6' }, // Blue
  { id: 'cat-eng', nameKh: 'ភាសាអង់គ្លេស', nameEn: 'English Language', color: '#8B5CF6' }, // Purple
  { id: 'cat-sci', nameKh: 'វិទ្យាសាស្ត្រ (រូប គីមី ជីវៈ)', nameEn: 'Sciences (Physics/Chem/Bio)', color: '#10B981' }, // Emerald
  { id: 'cat-hist', nameKh: 'ប្រវត្តិវិទ្យា', nameEn: 'History', color: '#F59E0B' }, // Amber
  { id: 'cat-geo', nameKh: 'ភូមិវិទ្យា', nameEn: 'Geography', color: '#14B8A6' }, // Teal
  { id: 'cat-ict', nameKh: 'បច្ចេកវិទ្យាព័ត៌មាន', nameEn: 'Information Technology', color: '#06B6D4' }, // Cyan
];

export function toKhmerDigits(numStr: string | number): string {
  const khmerNums = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(numStr).replace(/[0-9]/g, (w) => khmerNums[parseInt(w)]);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function generateBookCoverSvg(title: string, author: string, categoryId: string, barcode: string): string {
  const colors: Record<string, string> = {
    'cat-kh': '#EF4444',
    'cat-math': '#3B82F6',
    'cat-eng': '#8B5CF6',
    'cat-sci': '#10B981',
    'cat-hist': '#F59E0B',
    'cat-geo': '#14B8A6',
    'cat-ict': '#06B6D4',
  };
  const color = colors[categoryId] || '#64748B';
  
  const shortTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
  const mid = Math.floor(shortTitle.length / 2);
  let line1 = shortTitle;
  let line2 = '';
  
  if (shortTitle.length > 25) {
    const spaceIdx = shortTitle.indexOf(' ', mid - 5);
    if (spaceIdx !== -1 && spaceIdx < mid + 8) {
      line1 = shortTitle.substring(0, spaceIdx);
      line2 = shortTitle.substring(spaceIdx + 1);
    } else {
      line1 = shortTitle.substring(0, mid);
      line2 = shortTitle.substring(mid);
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">
      <rect width="300" height="450" fill="${color}" rx="12"/>
      <rect x="15" y="15" width="270" height="420" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" rx="8"/>
      <rect x="22" y="22" width="256" height="406" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="6"/>
      
      <rect x="0" y="0" width="20" height="450" fill="rgba(0,0,0,0.15)"/>
      <line x1="20" y1="0" x2="20" y2="450" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
      <line x1="8" y1="0" x2="8" y2="450" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
      
      <g transform="translate(150, 110)">
        <circle cx="0" cy="0" r="32" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <circle cx="0" cy="0" r="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4 2" stroke-width="1"/>
        <path d="M-12,-8 L0,-8 L12,-8 L12,8 L0,5 L-12,8 Z" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M0,-8 L0,5" stroke="#ffffff" stroke-width="1.5"/>
      </g>

      <text x="150" y="220" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle">
        ${escapeXml(line1)}
      </text>
      ${line2 ? `
      <text x="150" y="248" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">
        ${escapeXml(line2)}
      </text>` : ''}

      <line x1="80" y1="285" x2="220" y2="285" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="2 4"/>

      <text x="150" y="325" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="12" fill="rgba(255,255,255,0.9)" text-anchor="middle">
        ${escapeXml(author)}
      </text>
      
      <g transform="translate(150, 385)">
        <rect x="-60" y="-12" width="120" height="24" fill="rgba(255,255,255,0.15)" rx="4" stroke="rgba(255,255,255,0.2)" stroke-width="0.75"/>
        <text x="0" y="4" font-family="monospace" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">
          ${barcode}
        </text>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generate10000Books(): Book[] {
  const list: Book[] = [];
  
  const prefixes = ["សៀវភៅសិក្សាគោល", "ស្រាវជ្រាវ", "គោលការណ៍គ្រឹះនៃ", "មេរៀនសង្ខេប និងលំហាត់", "គន្លឹះដោះស្រាយលំហាត់", "សៀវភៅជំនួយស្មារតី", "ការវិភាគលម្អិត", "ទ្រឹស្តីគ្រឹះនៃ", "មគ្គុទ្ទេសក៍សិក្សា"];
  
  const subjectsMap: Record<string, string[]> = {
    'cat-kh': ["អក្សរសិល្ប៍ខ្មែរ ថ្នាក់ទី១២", "អក្សរសិល្ប៍ខ្មែរ ថ្នាក់ទី១១", "រឿង ទុំទាវ វិភាគ", "រឿង កុលាបប៉ៃលិន សិក្សា", "ក្បួនតែងសេចក្តី ថ្នាក់វិទ្យាល័យ", "ទស្សនវិទ្យាអក្សរសាស្ត្រ", "អក្សរសិល្ប៍ប្រជាប្រិយខ្មែរ", "វចនានុក្រមភាសាខ្មែរ សង្ខេប", "អក្សរសាស្ត្រខ្មែរទូទៅ", "វិភាគរឿងព្រេងខ្មែរ", "វប្បធម៌ខ្មែរ និងអរិយធម៌", "រឿង មហាភារតយុទ្ធ"],
    'cat-math': ["គណិតវិទ្យា ថ្នាក់ទី១២", "ធរណីមាត្រ ថ្នាក់វិទ្យាល័យ", "ពិជគណិត និងវិភាគ", "លំហាត់ព្រំដែន និងអាំងតេក្រាល", "លំហាត់ប្រូបាប៊ីលីតេ ពិសេស", "គណិតវិទ្យាថ្នាក់ទី១០-១១", "រូបមន្តមាស គណិតវិទ្យា", "គន្លឹះដោះស្រាយគណិតវិទ្យា រហ័ស", "ពិជគណិតលីនេអ៊ែរ", "ប្រព័ន្ធកូអរដោនេ", "ត្រីកោណមាត្រកម្រិតខ្ពស់", "ស៊េរី និងលីមីត"],
    'cat-eng': ["English Grade 12 Textbook", "English Grammar and Composition", "Vocabulary Builder Level 3", "IELTS Preparation Master", "High School Writing Essentials", "Interactive English Dialogues", "Reading Comprehension Skills", "Phonetics and Speaking Guide", "Business English Guide", "Academic Essay Writing", "English Idioms in Use", "Daily Conversation Practice"],
    'cat-sci': ["រូបវិទ្យា ថ្នាក់ទី១២ ភាគ១", "គីមីវិទ្យា សរីរាង្គ", "ជីវវិទ្យា និងប្រព័ន្ធអេកូឡូស៊ី", "លំហាត់រូបវិទ្យា ត្រៀមប្រឡងបាក់ឌុប", "គីមីវិទ្យា អសរីរាង្គ ថ្នាក់ទី១១", "មេរៀនរូបវិទ្យាសង្ខេប", "ជីវវិទ្យា កោសិកា និងហ្សែន", "ពិសោធន៍គីមីវិទ្យាជាក់ស្តែង", "មេកានិចរូបវិទ្យា", "គីមីវិទ្យាទូទៅ", "ជីវវិទ្យាប្រព័ន្ធរាងកាយ", "អេឡិចត្រូនិក និងអគ្គិសនី"],
    'cat-hist': ["ប្រវត្តិវិទ្យា ថ្នាក់ទី១២", "ប្រវត្តិសាស្ត្រខ្មែរ សង្ខេប", "ចក្រភពអង្គរ និងភាពរុងរឿង", "ប្រវត្តិសាស្ត្រអាស៊ីអាគ្នេយ៍", "សង្គ្រាមលោកលើកទី១ និងទី២", "ប្រវត្តិសាស្ត្រពិភពលោកទំនើប", "អរិយធម៌ខ្មែរ និងបរទេស", "ការយល់ដឹងពីសង្គមវិទ្យា", "ប្រវត្តិសាស្ត្រខ្មែរសម័យឧដុង្គ", "វប្បធម៌សន្តិភាព", "ប្រវត្តិសាស្ត្រអឺរ៉ុប", "ទំនាក់ទំនងអន្តរជាតិ"],
    'cat-geo': ["ភូមិវិទ្យារូបវន្ត ថ្នាក់ទី១១", "ភូមិវិទ្យាប្រទេសកម្ពុជា", "ផែនទីវិទ្យា និងការវាស់វែង", "ការប្រែប្រួលអាកាសធាតុសកល", "ធនធានធម្មជាតិ និងបរិស្ថាន", "ភូមិវិទ្យាសេដ្ឋកិច្ចពិភពលោក", "ភូមិវិទ្យាប្រជាសាស្ត្រ", "ប្រព័ន្ធព័ត៌មានភូមិវិទ្យា (GIS)", "តំបន់ទេសចរណ៍កម្ពុជា", "ការគ្រប់គ្រងបរិស្ថាន", "ភូមិវិទ្យាអាស៊ាន", "ការអភិវឌ្ឍប្រកបដោយចីរភាព"],
    'cat-ict': ["មូលដ្ឋានគ្រឹះ Web Development", "Python Programming for Beginners", "Database Systems & SQL", "Network Security Essentials", "C++ Programming Language", "Java Application Development", "Algorithms & Data Structures", "Mobile App Development", "Cloud Computing with GCP", "Machine Learning Basics", "UI/UX Design with Figma", "Linux System Administration"]
  };

  const authors = ["គឹម សេង", "សុខ ជា", "ចាន់ ថន", "ឡុង សារិន", "ម៉ៅ សំណាង", "អ៊ុំ សារឹម", "សួន សុជាតិ", "ព្រំ វីរៈ", "លី ប៊ុនហ៊ាង", "សួង សុភ័ក្ត្រ", "ហេង មុនី", "កែវ សុវណ្ណ", "សេង សុភ័ក្រ", "ឆែម បូរ៉ា", "ទេព សុភី", "Dr. Robert Smith", "Prof. Emily Parker", "Sarah Jenkins", "Michael Chang", "Dr. David Evans"];

  const catIds = ['cat-kh', 'cat-math', 'cat-eng', 'cat-sci', 'cat-hist', 'cat-geo', 'cat-ict'];

  // Add a few manual prominent ones first for consistency
  const manualBooks: Book[] = [
    {
      id: 'book-1',
      title: 'ភាសាខ្មែរ ថ្នាក់ទី១២ (ភាគ១)',
      barcode: 'KH-12-001',
      categoryId: 'cat-kh',
      author: 'ក្រសួងអប់រំ យុវជន និងកីឡា',
      publishYear: 2022,
      status: 'available',
      location: 'Shelf A1',
      addedDate: '2026-01-10',
    },
    {
      id: 'book-2',
      title: 'គណិតវិទ្យា ថ្នាក់ទី១២ (កម្រិតខ្ពស់)',
      barcode: 'MATH-12-002',
      categoryId: 'cat-math',
      author: 'ក្រសួងអប់រំ យុវជន និងកីឡា',
      publishYear: 2023,
      status: 'borrowed',
      location: 'Shelf B2',
      addedDate: '2026-01-12',
    },
    {
      id: 'book-3',
      title: 'English for Cambodia Book 12',
      barcode: 'ENG-12-003',
      categoryId: 'cat-eng',
      author: 'MoEYS Cambodia',
      publishYear: 2021,
      status: 'available',
      location: 'Shelf C1',
      addedDate: '2026-01-15',
    }
  ];

  for (const b of manualBooks) {
    b.coverImage = generateBookCoverSvg(b.title, b.author, b.categoryId, b.barcode);
    list.push(b);
  }

  // Generate the rest deterministically to get exactly 10,000 books
  for (let i = 4; i <= 10000; i++) {
    const catId = catIds[i % catIds.length];
    const subList = subjectsMap[catId] || subjectsMap['cat-kh'];
    const subject = subList[i % subList.length];
    const prefix = prefixes[(i * 3) % prefixes.length];
    
    let title = '';
    if (catId === 'cat-eng') {
      title = `${prefix} - ${subject} (Vol. ${Math.floor(i / 100) + 1})`;
    } else {
      title = `${prefix} ${subject} ភាគ ${toKhmerDigits((i % 5) + 1)}`;
    }

    const author = authors[(i * 7) % authors.length];
    const publishYear = 2012 + (i % 15);
    const barcode = `BK-${catId.replace('cat-', '').toUpperCase()}-${String(i).padStart(6, '0')}`;
    const location = `Shelf ${String.fromCharCode(65 + (i % 7))}-${(i % 10) + 1}`;
    
    let status: 'available' | 'borrowed' | 'overdue' | 'lost' = 'available';
    const statusVal = i % 100;
    if (statusVal < 5) {
      status = 'borrowed';
    } else if (statusVal === 5) {
      status = 'overdue';
    } else if (statusVal === 6) {
      status = 'lost';
    }

    const coverImage = generateBookCoverSvg(title, author, catId, barcode);

    list.push({
      id: `book-gen-${i}`,
      title,
      barcode,
      categoryId: catId,
      author,
      publishYear,
      status,
      location,
      addedDate: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      coverImage,
    });
  }

  return list;
}

export const defaultBooks: Book[] = generate10000Books();

export function generate2000Students(): Student[] {
  const list: Student[] = [];
  
  const manual = [
    {
      id: 'stu-1',
      studentId: 'STU-12A-0001',
      name: 'ចាន់ មុន្នី',
      gender: 'M' as const,
      classGrade: '12A',
      phoneNumber: '012 345 678',
      email: 'chan.monny@school.edu.kh',
      password: 'password123',
    },
    {
      id: 'stu-2',
      studentId: 'STU-12B-0002',
      name: 'សុខ គឹមហួរ',
      gender: 'F' as const,
      classGrade: '12B',
      phoneNumber: '098 765 432',
      email: 'sokh.kimhour@school.edu.kh',
      password: 'password123',
    },
    {
      id: 'stu-3',
      studentId: 'STU-11A-0003',
      name: 'លី ម៉េងហុង',
      gender: 'M' as const,
      classGrade: '11A',
      phoneNumber: '085 111 222',
      email: 'ly.menghong@school.edu.kh',
      password: 'password123',
    },
    {
      id: 'stu-4',
      studentId: 'STU-10C-0004',
      name: 'សេង ស្រីពៅ',
      gender: 'F' as const,
      classGrade: '10C',
      phoneNumber: '077 333 444',
      email: 'seng.sreypov@school.edu.kh',
      password: 'password123',
    },
    {
      id: 'stu-5',
      studentId: 'STU-12A-0005',
      name: 'កែវ វិសាល',
      gender: 'M' as const,
      classGrade: '12A',
      phoneNumber: '099 888 999',
      email: 'keo.visal@school.edu.kh',
      password: 'password123',
    }
  ];
  
  list.push(...manual);

  const lastNames = ['ចាន់', 'សេង', 'កែវ', 'សុខ', 'លី', 'ជា', 'នួន', 'ម៉ៅ', 'ទួន', 'ហេង', 'សោម', 'គង់', 'ភឿន', 'ម៉ែន', 'ស៊ិន', 'រ័ត្ន', 'ជាម', 'អ៊ុំ', 'តេង', 'ឡាយ'];
  const firstNames = ['មុន្នី', 'ស្រីពៅ', 'វិសាល', 'គឹមហួរ', 'ម៉េងហុង', 'រក្សា', 'សិលា', 'បញ្ញា', 'ធារី', 'លីដា', 'ទេវី', 'ដារ៉ា', 'វឌ្ឍនៈ', 'ពិសិដ្ឋ', 'មាលា', 'វណ្ណដា', 'សុជាតា', 'រដ្ឋា', 'វិបុល', 'ស្រីណុច'];
  const grades = ['10A', '10B', '10C', '11A', '11B', '11C', '12A', '12B', '12C'];

  for (let i = 6; i <= 2000; i++) {
    const ln = lastNames[i % lastNames.length];
    const fn = firstNames[(i * 3) % firstNames.length];
    const name = `${ln} ${fn}`;
    const gender = (i % 2 === 0) ? 'F' as const : 'M' as const;
    const grade = grades[i % grades.length];
    const stuIdNum = String(i).padStart(4, '0');
    const studentId = `STU-${grade}-${stuIdNum}`;
    
    const phoneSuffix = String(100000 + (i * 1234567) % 900000);
    const phoneNumber = `012 ${phoneSuffix.substring(0, 3)} ${phoneSuffix.substring(3)}`;
    const email = `student${i}@school.edu.kh`;
    const password = `pass${1000 + i}`;

    list.push({
      id: `stu-gen-${i}`,
      studentId,
      name,
      gender,
      classGrade: grade,
      phoneNumber,
      email,
      password,
    });
  }

  return list;
}

export const defaultStudents: Student[] = generate2000Students();

export const defaultBorrowRecords: BorrowRecord[] = [
  {
    id: 'rec-1',
    bookId: 'book-3', // English for Cambodia
    studentId: 'stu-1', // ចាន់ មុន្នី
    borrowDate: '2026-06-15',
    dueDate: '2026-06-25',
    returnDate: '2026-06-24',
    status: 'returned',
    notes: 'Returned in good condition',
  },
  {
    id: 'rec-2',
    bookId: 'book-2', // Mathematics Grade 12
    studentId: 'stu-2', // សុខ គឹមហួរ
    borrowDate: '2026-06-26',
    dueDate: '2026-07-06',
    status: 'borrowed',
    notes: 'Borrowing for upcoming national exams',
  },
  {
    id: 'rec-3',
    bookId: 'book-5', // Chemistry Grade 12
    studentId: 'stu-3', // លី ម៉េងហុង
    borrowDate: '2026-06-10',
    dueDate: '2026-06-20',
    status: 'overdue',
    notes: 'Called phone number twice - no response',
  },
  {
    id: 'rec-4',
    bookId: 'book-7', // Geography Grade 10
    studentId: 'stu-4', // សេង ស្រីពៅ
    borrowDate: '2026-05-12',
    dueDate: '2026-05-22',
    status: 'lost',
    notes: 'Student reported book lost, agreed to replace it',
  }
];

export const defaultUsers: User[] = [
  {
    id: 'u-1',
    username: 'admin',
    name: 'Sambat Chhunheang (Admin)',
    role: 'admin',
    lastLogin: '2026-07-01 08:30',
  },
  {
    id: 'u-2',
    username: 'librarian',
    name: 'Keo Samrang (Librarian)',
    role: 'librarian',
    lastLogin: '2026-07-01 07:45',
  }
];

export const defaultRoles: Role[] = [
  {
    id: 'admin',
    nameKh: 'អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)',
    nameEn: 'System Administrator',
    permissions: {
      manageBooks: true,
      manageStudents: true,
      borrowReturn: true,
      viewReports: true,
      manageRoles: true,
      systemBackup: true
    },
    isSystem: true
  },
  {
    id: 'librarian',
    nameKh: 'បណ្ណារក្ស (Librarian)',
    nameEn: 'Librarian',
    permissions: {
      manageBooks: true,
      manageStudents: true,
      borrowReturn: true,
      viewReports: true,
      manageRoles: false,
      systemBackup: false
    },
    isSystem: true
  }
];

export const defaultWishlist: WishlistItem[] = [
  {
    id: 'wish-1',
    title: 'រូបវិទ្យា ថ្នាក់ទី១២',
    author: 'ក្រសួងអប់រំ យុវជន និងកីឡា',
    requesterName: 'សុខ គឹមហួរ',
    requestDate: '2026-06-28',
    status: 'pending',
    notes: 'Required for college preparations'
  },
  {
    id: 'wish-2',
    title: 'ប្រលោមលោក រឿងតេជោតំឌិន',
    author: 'គង់ ប៊ុនឈឿន',
    requesterName: 'លី ម៉េងហុង',
    requestDate: '2026-06-30',
    status: 'approved',
    notes: 'Recommended classic Khmer literature reading'
  },
  {
    id: 'wish-3',
    title: 'គីមីវិទ្យា ថ្នាក់ទី១២ (Chemistry Grade 12)',
    author: 'ក្រសួងអប់រំ យុវជន និងកីឡា',
    requesterName: 'ចាន់ ណារ៉េត',
    requestDate: '2026-07-02',
    status: 'acquired',
    notes: 'Successfully acquired and added to catalog'
  }
];

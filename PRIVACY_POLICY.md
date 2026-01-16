# Privacy Policy

**Bunkialo**  
*Last Updated: January 16, 2026*

## 1. Introduction

Bunkialo is a student-focused mobile application designed to help IIIT Kottayam students track their attendance and manage assignments from the institute's Learning Management System (LMS). This Privacy Policy explains how we collect, use, store, and protect your information.

## 2. Information We Collect

### 2.1 Authentication Information
- **Username and Password**: Your IIIT Kottayam LMS credentials are stored securely on your device using Expo Secure Store
- **Session Cookies**: Temporary session cookies are maintained to keep you logged into the LMS

### 2.2 Academic Data
- **Attendance Records**: Course attendance data including dates, status (Present/Absent/Late/Excused), and remarks
- **Course Information**: Course names, IDs, and enrollment details
- **Timeline Events**: Assignment deadlines, events, and academic calendar information from the LMS

### 2.3 App Usage Data
- **User Preferences**: Settings for refresh intervals, notifications, and reminders
- **Local Data**: Bunk records, duty leave notes, and personal attendance tracking
- **App Logs**: Debug information stored locally for troubleshooting (never transmitted)

## 3. How We Use Your Information

### 3.1 Primary Purpose
- **Authentication**: To securely log you into the IIIT Kottayam LMS
- **Data Synchronization**: To fetch and display your attendance and assignment information
- **Offline Access**: To cache data for use when internet connectivity is unavailable
- **Notifications**: To send you reminders about upcoming assignments and attendance thresholds

### 3.2 Data Processing
- All data processing happens locally on your device
- We do not collect, store, or transmit any personal information to external servers
- The app functions as a local interface to the official IIIT Kottayam LMS

## 4. Data Storage and Security

### 4.1 Local Storage
- **Credentials**: Stored using Expo Secure Store with device-level encryption
- **Academic Data**: Stored locally using AsyncStorage for offline access
- **User Preferences**: Stored locally to maintain your app settings

### 4.2 Security Measures
- Credentials are encrypted using the device's secure storage mechanisms
- Session cookies are managed securely and cleared upon logout
- No data is transmitted to third-party servers or analytics services
- All communications are directly with the official IIIT Kottayam LMS

## 5. Data Sharing and Disclosure

### 5.1 No Third-Party Sharing
- We do not share, sell, or rent your personal information to third parties
- No analytics or advertising SDKs are integrated into this app
- Your data never leaves your device except for direct LMS communication

### 5.2 LMS Communication
- The app only communicates with `lmsug24.iiitkottayam.ac.in`
- This communication is necessary to fetch your attendance and assignment data
- We do not intercept, modify, or store any LMS data beyond what's displayed in the app

## 6. Your Rights and Choices

### 6.1 Data Control
- **Access**: You can view all your stored data within the app
- **Deletion**: Clear credentials and logout to remove all stored authentication data
- **Modification**: Update your preferences and bunk records at any time
- **Export**: Your data is stored locally and accessible through device file management

### 6.2 Account Management
- **Login/Logout**: Full control over your LMS session
- **Credential Storage**: Option to save or not save credentials on your device
- **Background Sync**: Control over automatic data refresh intervals

## 7. Children's Privacy

This app is designed for university students (typically 18+ years of age). We do not knowingly collect information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.

## 8. Data Retention

### 8.1 Local Data
- Attendance data is retained until you manually clear it or uninstall the app
- Cached assignment data is refreshed according to your sync settings
- App preferences are retained until you change them or uninstall the app

### 8.2 Session Data
- Session cookies are automatically cleared when you logout
- Authentication tokens are valid only for the current LMS session

## 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by:
- Updating the "Last Updated" date at the top of this policy
- Displaying a notification within the app when significant changes occur

## 10. Contact Information

If you have questions or concerns about this Privacy Policy, please contact us:

- **App Name**: Bunkialo
- **Purpose**: Student attendance and assignment tracking for IIIT Kottayam
- **Data Controller**: The app user (you) - your data stays on your device

## 11. Technical Implementation Details

### 11.1 Libraries Used
- `expo-secure-store`: For encrypted credential storage
- `@react-native-async-storage/async-storage`: For local data caching
- `axios`: For secure HTTP communications with the LMS
- `htmlparser2`: For parsing LMS HTML responses locally

### 11.2 Network Communications
- **Target Domain**: `lmsug24.iiitkottayam.ac.in`
- **Protocol**: HTTPS only
- **Data Flow**: Device ↔ LMS (no intermediaries)
- **No Analytics**: No tracking or analytics libraries are used

## 12. Important Notes

- This app is **not affiliated** with IIIT Kottayam or the official LMS development team
- The app acts as a **client interface** to the existing LMS
- All academic data remains the property of IIIT Kottayam and is subject to their policies
- This Privacy Policy covers only the Bunkialo app's handling of your data

---

**By using Bunkialo, you acknowledge that you have read and understood this Privacy Policy.**

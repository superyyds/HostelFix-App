HostelFix: Real-time Facility Management System (CMT322 Simulation)

This is the front-end simulation for the HostelFix application, designed to handle facility complaints, tracking, and management for university hostels. It uses React for the user interface and is prepared to integrate with Firebase Firestore for real-time, role-based data management.

🌟 Core Features Implemented (Part A - Simulation)

The current working prototype includes the full User Management Module (Module 1) and navigational placeholders for the core modules.

Module 1: User Management

Role-Based Access Control: Users explicitly select their role (Student or Warden/Staff) at login.

Email Login: Authentication is simulated using an Email and Password structure.

Multi-Page Navigation: Successful login redirects users to distinct Student or Warden Dashboards.

Navigational Structure

Student Dashboard Links:

Register Complaint

Complaint Tracking

Announcements

Warden Dashboard Links:

New Complaints

Feedback Review

Generate Reports

🚀 Getting Started (Instructions for Team Members)

Follow these steps to clone the repository and run the application locally.

Step 1: Prerequisites

Ensure you have the following software installed on your machine. You will need a Terminal (like VS Code's Integrated Terminal, PowerShell, or Git Bash) for all command-line operations.

---> Node.js (LTS version): Required to run JavaScript outside the browser and to use npm.

---> Git: Required to download (clone) the code from GitHub.

Step 2: Clone the Repository

----> Open your Terminal.

---> Navigate to the folder where you want to save the project (e.g., cd ~/Documents/Projects).

Run the following command to download the code:

---> git clone [YOUR_GITHUB_REPOSITORY_URL]
---> cd HostelFix-App


(Replace [YOUR_GITHUB_REPOSITORY_URL] with the actual HTTPS or SSH link from your GitHub page.)

Step 3: Install Dependencies

---> This project uses React and the Vite development server. You must install all necessary libraries before running the app.

---> Run this command in the project's root directory (HostelFix-App):

---> npm install


(This command reads the package.json file and installs all required packages, including react, vite, and lucide-react for icons.)

Step 4: Run the Application

Start the local development server to view the application in your browser.

---> npm run dev


The terminal will provide a local URL (e.g., http://localhost:5173/). Hold Ctrl (or Cmd on Mac) and click the link to open HostelFix.

🔑 Simulated Login Credentials (Use for Testing)

<<< Student Access >>>

Role: Student

Email (Simulated): student@hostel.edu

Password (Simulated): password

Dashboard Access: Complaints, Feedback, Announcements

<<< Warden / Staff Access >>>

Role: Warden / Staff

Email (Simulated): warden@hostel.edu

Password (Simulated): password

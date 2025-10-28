HostelFix: Real-time Facility Management System (CMT322 Simulation)

This is the front-end simulation for the HostelFix application, designed to handle facility complaints, tracking, and management for university hostels. It uses React and Firebase Firestore for a real-time, role-based experience.

🌟 Core Features Implemented (Part A)

Role-Based Access Control (Module 1): Users log in as either Student or Warden/Staff via distinct email IDs.

Multi-Page Navigation: The Dashboard features clear tabbed navigation to separate the three main modules: Complaints, Feedback, and Announcements/Reports.

Complaint Submission (Module 2.1): Students can submit new facility complaints with category, description, and priority.

Complaint Tracking & Resolution (Module 2.3 & 2.4): Wardens can update statuses (Pending, In Progress, Resolved). Status updates and resolution remarks are visible in real-time.

Data Persistence: All complaints are saved and retrieved in real-time using Firebase Firestore (public collection for easy collaboration).

🚀 Getting Started

Prerequisites

You need the following installed on your machine:

Node.js (LTS version recommended)

npm (comes with Node.js)

Git

Simulated Login

Use these credentials to test the application's different views:

Role

Email (Simulated)

Password (Simulated)

Dashboard Access

Student

student@hostel.edu

password

Complaints, Feedback, Announcements

Warden / Staff

warden@hostel.edu

password

Complaints, Feedback, Reports

🛠️ Planned Modules (For Team Collaboration)

Feedback Management (Module 3): Needs the form for student ratings and the analytics view for wardens.

Announcements/Reports (Module 4): Needs the content creation/posting feature and the analytics dashboards.
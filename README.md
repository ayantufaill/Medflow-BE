# MedFlow Backend

A robust and scalable healthcare API backend built with Node.js and Express.js. MedFlow Backend provides a comprehensive suite of RESTful APIs for managing medical data, patient information, appointments, and healthcare workflows.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Support](#support)

---

## 📌 Overview

**MedFlow Backend** is a production-ready healthcare API service designed to streamline medical workflows and data management. It provides developers with a comprehensive REST API for integrating healthcare functionalities into their applications, including patient management, appointment scheduling, medical records, and more.

### Key Objectives

- **Secure Data Management**: Handle sensitive healthcare data with industry-standard security practices
- **Scalable Architecture**: Built to handle high-volume healthcare operations
- **Developer-Friendly**: Clear API documentation and easy integration
- **HIPAA-Compliant**: Designed with healthcare compliance in mind

---

## ✨ Features

- ✅ **Patient Management**: Create, read, update, and manage patient records
- ✅ **Appointment Scheduling**: Book, reschedule, and manage medical appointments
- ✅ **Medical Records**: Store and retrieve patient medical history and documents
- ✅ **User Authentication**: Secure JWT-based authentication system
- ✅ **Role-Based Access Control (RBAC)**: Fine-grained permission management
- ✅ **RESTful API**: Clean, intuitive API design following REST principles
- ✅ **Real-time Documentation**: Interactive Swagger UI for API exploration
- ✅ **Error Handling**: Comprehensive error responses and logging
- ✅ **Docker Support**: Containerized deployment for easy scaling
- ✅ **Environment Configuration**: Flexible configuration management

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js (v14+) |
| **Framework** | Express.js |
| **Language** | JavaScript (ES6+) |
| **API Documentation** | Swagger/OpenAPI |
| **Authentication** | JWT (JSON Web Tokens) |
| **Containerization** | Docker & Docker Compose |
| **Version Control** | Git |

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher) or **yarn**
- **Docker** (v20.0 or higher) - for containerized deployment
- **Docker Compose** (v1.29.0 or higher) - for multi-container setup
- **Git** (for cloning the repository)

---

## 🚀 Getting Started

Follow these steps to set up and run MedFlow Backend locally with Docker.

### Step 1: Clone the Repository

Clone the medflow-be repository from GitHub to your local machine:

```bash
git clone https://github.com/ayantufaill/medflow-be.git
```

### Step 2: Navigate to Project Directory

Enter the project folder:

```bash
cd medflow-be
```

### Step 3: Add Environment Configuration

Obtain the `.env` file from your project maintainer or team lead and place it in the root directory of the project (same level as `package.json`).

### Step 4: Install Dependencies

Install all required Node.js dependencies:

```bash
npm install
```

### Step 5: Build and Run with Docker

Build the Docker image and start the application using Docker Compose:

```bash
docker-compose up -d
```

This command will:
- Build the Docker image from the Dockerfile
- Start the application container
- Run the application on port `5001`
- Start in detached mode (runs in background)

### Step 6: Verify the Application is Running

Check if the application is healthy by visiting:

```
http://localhost:5001/health
```

You should receive a healthy response from the API.

### Step 7: Access the API Documentation

Open your browser and navigate to the Swagger documentation:

```
http://localhost:5001/api-docs/
```

Here you can explore all available endpoints and test the API.

### ✅ Setup Complete!

Your MedFlow Backend is now running and ready to use. You can:
- Test API endpoints in Swagger UI
- Make API requests to `http://localhost:5001`
- View application logs with: `docker-compose logs -f medflow-be`
- Stop the application with: `docker-compose down`

---

## 📋 Useful Docker Commands

```bash
# View application logs
docker-compose logs -f medflow-be

# Stop the application
docker-compose down

# Rebuild the image (if changes made)
docker-compose build --no-cache

# Restart the application
docker-compose restart
```

## 🔌 API Endpoints

MedFlow Backend provides a comprehensive set of RESTful API endpoints organized into the following main categories:

- **Authentication** - User registration, login, token refresh, and logout
- **Patients** - Patient management operations (create, read, update, delete)
- **Appointments** - Appointment scheduling and management
- **Medical Records** - Medical history and records management

**📌 Note**: For complete endpoint documentation, request/response examples, and real-time API testing, refer to the **Swagger UI** at `http://localhost:5001/api-docs/`

---

## 🔐 Authentication

### JWT (JSON Web Tokens)

MedFlow Backend uses JWT (JSON Web Tokens) for secure, stateless authentication. Upon successful login, users receive a JWT token that must be included in the `Authorization` header for all authenticated requests.

### Token Usage

Include the JWT token in the `Authorization` header for all protected API endpoints:

```
Authorization: Bearer <your_jwt_token>
```

For more details on authentication flows and endpoints, refer to the Swagger documentation at `http://localhost:5001/api-docs/`

---

## 👥 Authorization

### Role-Based Access Control (RBAC)

MedFlow Backend implements role-based access control with the following default roles:

| Role | Permissions | Description |
|------|-----------|-------------|
| **Admin** | All operations | Full system access |
| **Doctor** | Read/Write patients, appointments, records | Healthcare provider access |
| **Patient** | Read own data, book appointments | Patient self-service access |
| **Staff** | Manage appointments, view records | Administrative staff access |

### Role Assignment

Users are assigned roles during registration or by admin users. Roles determine which API endpoints and operations are accessible. Each role has specific permissions that restrict or allow access to certain API endpoints and operations.

For detailed information on role-based access control implementation and endpoint protection, please refer to the Swagger documentation at `http://localhost:5001/api-docs/`

---

## 💬 Support

### Documentation

- 📖 [Swagger API Documentation](http://localhost:5001/api-docs/) - Available when running locally
- 📝 [GitHub Wiki](https://github.com/ayantufaill/medflow-be/wiki) - Additional documentation
- 🐛 [Issues Page](https://github.com/ayantufaill/medflow-be/issues) - Report bugs or request features

### Getting Help

1. **Check the documentation** - Most questions are answered in the docs
2. **Search existing issues** - Your question might already be answered
3. **Create a new issue** - If you can't find the answer
4. **Contact the maintainers** - For urgent support


## 🚀 Quick Start Checklist

- [ ] Clone the repository: `git clone https://github.com/ayantufaill/medflow-be.git`
- [ ] Navigate to project: `cd medflow-be`
- [ ] Obtain `.env` file from maintainer and place in root directory
- [ ] Install dependencies: `npm install`
- [ ] Build and run with Docker: `docker-compose up -d`
- [ ] Verify health: Visit `http://localhost:5001/health`
- [ ] Access Swagger UI: Visit `http://localhost:5001/api-docs/`
- [ ] Start testing API endpoints!

---

## 📊 Project Statistics

- **Language**: JavaScript (Node.js)
- **Framework**: Express.js
- **License**: MIT
- **Repository**: [github.com/ayantufaill/medflow-be](https://github.com/ayantufaill/medflow-be)

---

## 🙏 Acknowledgments

Thank you to all contributors and users who have helped improve MedFlow Backend!

---

**Maintainer**: Ayan Tufail

For the latest updates, visit: [github.com/ayantufaill/medflow-be](https://github.com/ayantufaill/medflow-be)

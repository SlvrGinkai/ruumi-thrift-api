# Ruumi Thrift API

Backend service for **Ruumi Thrift: Campus P2P Marketplace**, a peer-to-peer marketplace designed for students within the campus ecosystem.

The API provides the foundation for item listings, search, offers, transactions, trust and safety checks, and supporting infrastructure.

> **Status:** Under Development

---

## Tech Stack

| Technology         | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| **Node.js**        | JavaScript/TypeScript runtime                   |
| **TypeScript**     | Primary programming language                    |
| **Fastify**        | HTTP API framework                              |
| **PostgreSQL**     | Primary relational database                     |
| **Prisma**         | ORM and database access layer                   |
| **Redis**          | Caching and performance layer                   |
| **MinIO**          | S3-compatible object storage for item images    |
| **Docker**         | Application and infrastructure containerization |
| **Docker Compose** | Local multi-service development environment     |
| **npm**            | Package and dependency management               |

---

# Technology Decisions

## 1. Fastify

Fastify was selected as the API framework instead of Express.js.

### Why Fastify?

Fastify provides a lightweight and performance-oriented foundation for the API. This is particularly relevant to Ruumi Thrift because the assessment expects the system to remain responsive as the number of listings grows.

Fastify also provides:

- Strong TypeScript support
- Schema-based request validation
- Plugin-based architecture
- Low overhead
- A clear separation between application components

The plugin architecture is useful for features such as authentication, database connections, Redis, and shared application configuration.

### Fastify vs Express

| Factor         | Fastify         | Express                     |
| -------------- | --------------- | --------------------------- |
| Performance    | High            | Good                        |
| TypeScript     | Strong support  | Requires additional setup   |
| Validation     | Schema-based    | Usually external middleware |
| Architecture   | Plugin-oriented | Middleware-oriented         |
| Ecosystem      | Smaller         | Very large                  |
| Learning curve | Moderate        | Easier                      |

### Tradeoff

The main disadvantage of Fastify is its smaller ecosystem compared with Express. Express has existed for longer and has a larger number of tutorials, middleware packages, and community examples.

For this project, Fastify's performance, TypeScript support, and structured plugin architecture are considered more valuable than Express's larger ecosystem.

---

# 2. PostgreSQL + Redis

The system uses **PostgreSQL as the primary database** and **Redis as a caching layer**.

## PostgreSQL

PostgreSQL stores persistent application data such as:

- User-related references
- Item listings
- Offers
- Transactions
- Item metadata
- Image references

PostgreSQL is appropriate because the marketplace contains strongly related entities and requires reliable transaction handling.

For example:

```text
User
 │
 ├── Item
 │
 └── Offer
       │
       └── Transaction
```

The relational model makes these relationships explicit and allows the application to enforce data integrity.

PostgreSQL also provides indexing capabilities that can support responsive searching as the number of listings increases.

### Why PostgreSQL instead of a NoSQL database?

A relational database is appropriate for this system because the transaction workflow requires consistent relationships between users, items, offers, and transactions.

The marketplace also requires controlled state transitions and reliable persistence, making PostgreSQL a suitable primary data store.

---

## Redis

Redis is used as a **cache**, rather than the primary source of truth.

Potential cached data includes:

- Frequently requested search results
- Popular listings
- Frequently accessed listing information

The general request flow is:

```text
Client
   │
   ▼
Fastify API
   │
   ▼
Check Redis
   │
   ├── Cache Hit ──────► Return cached data
   │
   └── Cache Miss
           │
           ▼
      PostgreSQL
           │
           ▼
      Store in Redis
           │
           ▼
      Return result
```

### Why Redis?

Search and listing endpoints can receive a large number of repeated requests. Caching frequently requested results reduces unnecessary database queries and helps maintain API responsiveness.

### Tradeoff

Redis introduces additional infrastructure and operational complexity.

The system must also handle cache expiration and invalidation.

Redis is therefore treated as an optimization rather than a required source of truth.

If Redis becomes unavailable, the API should fall back to PostgreSQL. The application may become slower, but persistent data remains available.

---

# 3. MinIO

MinIO is used for storing uploaded item images.

Images are **not stored directly inside PostgreSQL**.

Instead:

```text
Client
   │
   │ Upload image
   ▼
MinIO
   │
   │ Image URL / object reference
   ▼
PostgreSQL
```

The database stores metadata and a reference to the image, while the actual image file remains in object storage.

### Why MinIO?

The assessment requires a solution where images are not stored on the application server or directly inside the database.

MinIO provides an S3-compatible object storage interface while being suitable for local development through Docker.

It also provides a path toward production deployment using an S3-compatible cloud storage provider.

### Tradeoff

MinIO introduces another service that must be operated and backed up.

A local filesystem would be simpler for a small development project, but it is less suitable for a production-oriented architecture because application servers should not be responsible for permanently storing uploaded media.

Object storage also makes it easier to serve uploaded images independently from the API application.

---

# 4. Docker

Docker is used to provide a consistent and reproducible development environment.

The project runs its supporting infrastructure as separate containers:

```text
                    Docker Compose
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   Fastify API      PostgreSQL         Redis
        │
        │
        ▼
      MinIO
```

The environment can be started with:

```bash
docker compose up --build
```

and stopped with:

```bash
docker compose down
```

### Why Docker?

Without Docker, developers would need to manually install and configure:

- Node.js
- PostgreSQL
- Redis
- MinIO

Docker provides an isolated and reproducible environment where the required services can be started consistently.

This also reduces differences between development environments.

### Docker tradeoff

Docker adds some complexity compared with installing services directly on the host machine.

It also introduces additional concepts such as:

- Images
- Containers
- Volumes
- Networks
- Container environment variables

However, the benefits are significant for this project because the backend depends on multiple infrastructure services.

Docker also makes the project easier for another developer to run without manually configuring each dependency.

---

# Architecture Overview

The initial architecture is:

```text
                 Client
                   │
                   ▼
              Fastify API
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
   PostgreSQL    Redis       MinIO
   Persistent    Cache       Images
     Data
```

### Responsibilities

**Fastify**

Handles:

- HTTP requests
- Routing
- Validation
- Authentication middleware
- Business logic orchestration

**PostgreSQL**

Handles:

- Persistent application data
- Relationships
- Transactions
- Database constraints
- Indexed searches

**Redis**

Handles:

- Frequently requested cached data
- Search result caching
- Popular listing caching

**MinIO**

Handles:

- Item images
- Object storage
- Image retrieval

---

# Design Principles

The backend will follow several principles:

### Separation of concerns

Application responsibilities will be separated into layers such as:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Prisma
  ↓
PostgreSQL
```

This prevents database operations and business logic from becoming tightly coupled to HTTP routes.

### PostgreSQL as the source of truth

Redis will only be used for performance optimization.

Important marketplace state will always be persisted in PostgreSQL.

### Stateless API

Authentication will use the existing RUUMI JWT-based authentication system rather than storing user sessions inside the API.

### Object storage for media

Images will be stored in MinIO rather than in PostgreSQL or the API container filesystem.

---

# Running the Project

## Prerequisites

The following are required:

- Docker
- Docker Compose
- Node.js
- npm

## Start the infrastructure

```bash
docker compose up --build
```

## Run in the background

```bash
docker compose up -d
```

## View running containers

```bash
docker compose ps
```

## View logs

```bash
docker compose logs
```

For a specific service:

```bash
docker compose logs api
```

## Stop the environment

```bash
docker compose down
```

Persistent Docker volumes are used for services that require data persistence.

---

# Future Components

The following components will be implemented as development progresses:

- Prisma database schema and migrations
- JWT authentication middleware
- KYC verification middleware
- Item listing APIs
- Item search and filtering
- Cursor-based pagination
- Image upload APIs
- Offer and transaction state machine
- Redis caching and invalidation
- Rate limiting
- Unit tests
- Integration tests
- API documentation

---

# Assessment Considerations

The architecture is designed around the requirements of the Ruumi Thrift backend assessment, particularly:

- Responsive item search
- Persistent transaction state
- KYC and trust checks
- Caching
- Image storage
- Rate limiting
- Pagination
- Docker-based deployment
- Developer experience

The implementation will prioritize a small, reliable scope over unnecessary complexity.

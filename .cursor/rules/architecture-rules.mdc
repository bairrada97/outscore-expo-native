---
description: Core architecture principles
alwaysApply: true
---

# Outscore backend Architecture Principles

## Core Rules (Full Details: docs/backend-architecture-guidelines.md)

**You MUST read `docs/backend-architecture-guidelines.md` when:**

### Module Structure & Organization

- Creating new modules or modifying existing module structure
- Adding new routes or endpoints to the API
- Organizing code within the `apps/backend/src/modules/` directory
- Deciding where to place new functionality (which module it belongs to)
- Understanding the module structure and file organization patterns

### Caching Implementation

- Implementing or modifying caching strategies
- Working with Edge Cache, KV, or R2 storage
- Setting TTL values or cache keys
- Implementing request deduplication
- Deciding which cache layer to use for new data
- Understanding cache key naming conventions
- Implementing stale-while-revalidate patterns
- Handling cache invalidation

### API Development

- Creating new API endpoints
- Implementing request validation (Zod schemas)
- Handling query parameters and responses
- Implementing error handling patterns
- Understanding response format and structure
- Adding new query parameters to existing endpoints
- Designing API response schemas

### Security & Middleware

- Adding or modifying security middleware
- Implementing rate limiting
- Configuring CORS policies
- Adding bot protection or secure headers
- Understanding the middleware execution order
- Modifying security headers (HSTS, CSP, etc.)
- Implementing IP-based rate limiting

### Data Transformation

- Working with timezone transformations
- Filtering or formatting fixtures data
- Implementing date handling logic
- Grouping and sorting data structures
- Understanding timezone-aware data delivery
- Converting UTC timestamps to user timezones
- Filtering fixtures by local date

### Background Tasks & Scheduling

- Implementing scheduled tasks or cron jobs
- Working with Durable Objects for alarms
- Implementing background refresh logic
- Setting up 15-second refresh intervals
- Understanding the alarm chain pattern
- Configuring cron triggers as failsafes
- Implementing prefetching strategies

### Quota Management

- Implementing quota tracking
- Working with Durable Objects for atomic counters
- Configuring quota limits and alerts
- Preventing race conditions in quota tracking
- Understanding daily/hourly quota limits
- Implementing quota validation and checks

### Date Transition Management

- Handling date transitions (midnight UTC)
- Moving files between R2 folders (today/historical/future)
- Invalidating caches on date changes
- Understanding folder structure transitions
- Implementing date transition detection
- Cleaning up old cache data

### Architecture Patterns

- Making architectural decisions
- Choosing between different caching layers
- Designing data flow patterns
- Implementing new features that affect the overall architecture
- Understanding request flow and data transformation pipeline
- Deciding on performance vs. cost trade-offs
- Planning scalability improvements

### Performance Optimization

- Optimizing response times (target: <50ms)
- Improving cache hit rates (target: >95%)
- Reducing API quota usage
- Understanding performance targets and metrics
- Implementing request deduplication
- Analyzing cache hit/miss patterns
- Optimizing timezone transformations

### Cloudflare Configuration

- Modifying `wrangler.toml` configuration
- Setting up R2 buckets or KV namespaces
- Configuring Durable Objects
- Setting up cron triggers
- Understanding environment bindings
- Configuring rate limiters
- Setting up observability

### Metrics & Monitoring

- Implementing metrics tracking
- Understanding performance targets
- Analyzing response time buckets
- Tracking cache hit rates
- Monitoring error rates
- Understanding the metrics endpoint structure

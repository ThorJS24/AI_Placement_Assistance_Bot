import json
import os

DSA_FILE = "backend/data/dsa_questions.json"

with open(DSA_FILE, "r", encoding="utf-8") as f:
    questions = json.load(f)

# Tag existing questions
for q in questions:
    topic = (q.get("topic") or "").lower()
    if "system design" in topic:
        q["domain"] = "system_design"
    elif "sql" in topic or "dbms" in topic or "database" in topic:
        q["domain"] = "sql"
    elif "web" in topic or "api" in topic:
        q["domain"] = "web_dev"
    elif "os" in topic or "operating" in topic or "network" in topic:
        q["domain"] = "cs_fundamentals"
    else:
        q["domain"] = "dsa"

# Add rich SQL questions
sql_questions = [
    {
        "id": "sql-001",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Amazon", "Google", "Microsoft", "TCS"],
        "title": "Second Highest Salary",
        "description": "Write a SQL query to find the second highest salary from the Employee table. If there is no second highest salary, return NULL.",
        "input_format": "Table: Employee (id INT, salary INT)",
        "output_format": "Single column: SecondHighestSalary",
        "starter_code": "-- Write your PostgreSQL / SQLite query below\nSELECT DISTINCT salary AS SecondHighestSalary\nFROM Employee\nORDER BY salary DESC\nLIMIT 1 OFFSET 1;\n",
        "editorial": "### SQL Approach\n\nUse `DISTINCT` to avoid duplicate salaries, `ORDER BY salary DESC` to rank from highest to lowest, and `LIMIT 1 OFFSET 1` to skip the highest salary and pick the second highest.\n\n```sql\nSELECT (\n  SELECT DISTINCT salary\n  FROM Employee\n  ORDER BY salary DESC\n  LIMIT 1 OFFSET 1\n) AS SecondHighestSalary;\n```",
        "hints": [
          "Use ORDER BY salary DESC to sort descending.",
          "Use LIMIT 1 OFFSET 1 to get the 2nd row."
        ],
        "test_cases": [
          {
            "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 100), (2, 200), (3, 300);",
            "expected": "200"
          }
        ]
    },
    {
        "id": "sql-002",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Amazon", "Flipkart", "Infosys"],
        "title": "Department Highest Salary",
        "description": "Write a SQL query to find employees who have the highest salary in each of the departments.",
        "input_format": "Table: Employee (id INT, name VARCHAR, salary INT, departmentId INT)\nTable: Department (id INT, name VARCHAR)",
        "output_format": "Columns: Department, Employee, Salary",
        "starter_code": "-- Write your SQL query below\nSELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON e.departmentId = d.id\nWHERE (e.departmentId, e.salary) IN (\n  SELECT departmentId, MAX(salary)\n  FROM Employee\n  GROUP BY departmentId\n);\n",
        "editorial": "### SQL Approach\n\nGroup by `departmentId` and compute `MAX(salary)`. Then filter employees whose `(departmentId, salary)` tuple matches the max tuple.\n\n```sql\nSELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON e.departmentId = d.id\nWHERE (e.departmentId, e.salary) IN (\n  SELECT departmentId, MAX(salary)\n  FROM Employee\n  GROUP BY departmentId\n);\n```",
        "hints": [
          "Use GROUP BY departmentId to find max salary per department.",
          "JOIN Employee with Department on departmentId."
        ],
        "test_cases": [
          {
            "input": "CREATE TABLE Department (id INT, name VARCHAR);\nCREATE TABLE Employee (id INT, name VARCHAR, salary INT, departmentId INT);\nINSERT INTO Department VALUES (1, 'IT'), (2, 'Sales');\nINSERT INTO Employee VALUES (1, 'Joe', 85000, 1), (2, 'Henry', 80000, 2), (3, 'Sam', 60000, 2), (4, 'Max', 90000, 1);",
            "expected": "IT Max 90000\nSales Henry 80000"
          }
        ]
    }
]

# Add System Design questions
sd_questions = [
    {
        "id": "sd-001",
        "domain": "system_design",
        "topic": "System Design",
        "difficulty": "Medium",
        "companies": ["Google", "Amazon", "Uber"],
        "title": "Design a Scalable URL Shortener (TinyURL)",
        "description": "Design a high-throughput URL shortening service like TinyURL or bit.ly. System needs to handle 100M new URLs created per month and 1B redirects per month (10:1 read/write ratio).\n\nKey Requirements:\n1. Short URL generation (Base62 encoding of 64-bit auto-increment ID or MD5 hash prefix).\n2. Fast redirection (<10ms latency) using Redis cache.\n3. Custom short alias support.\n4. Expiration policy and analytics tracking.\n\nWrite down your architectural design components, database schema (Relational vs NoSQL), caching strategy, and load balancing setup.",
        "input_format": "Architecture design description & component breakdown",
        "output_format": "Structured System Architecture Specification",
        "starter_code": "### 1. High-Level Architecture\n- API Gateway: Nginx / Envoy Load Balancer\n- App Servers: Stateless Node.js / FastAPI web workers\n- Cache Layer: Redis cluster for hot short URL lookups\n- Storage Layer: PostgreSQL / Cassandra for URL mappings\n\n### 2. Base62 Encoding & ID Generation\n# Base62 chars: [0-9a-zA-Z] (62 chars)\n# 62^7 = ~3.5 Trillion unique short URLs\n",
        "editorial": "### System Architecture Solution\n\n1. **API Endpoints**:\n   - `POST /api/v1/data/shorten` -> `{ longUrl: string, customAlias?: string }`\n   - `GET /{shortCode}` -> `302 Found` redirect to longUrl.\n2. **ID Generator**:\n   - Distributed ID generator (Snowflake / ZooKeeper range allocator) to avoid collision.\n3. **Caching Strategy**:\n   - Redis LRU cache storing `shortCode -> longUrl` with 80/20 rule (cache top 20% URLs).\n4. **Database**:\n   - NoSQL (Cassandra / DynamoDB) or Sharded PostgreSQL for high write throughput.",
        "hints": [
          "Base62 uses 62 alphanumeric characters (a-z, A-Z, 0-9).",
          "Use a 302 (Found) redirect instead of 301 (Moved Permanently) if you want to track analytics per click."
        ],
        "test_cases": [
          {
            "input": "shorten: https://example.com/very/long/url",
            "expected": "302 Redirect to https://example.com/very/long/url"
          }
        ]
    },
    {
        "id": "sd-002",
        "domain": "system_design",
        "topic": "System Design",
        "difficulty": "Hard",
        "companies": ["Amazon", "Meta", "Stripe"],
        "title": "Design an API Rate Limiter",
        "description": "Design an API Rate Limiter service to prevent DOS attacks and abuse. The rate limiter should limit clients to 100 requests per minute per IP or User ID.\n\nCompare Rate Limiting Algorithms:\n1. Token Bucket\n2. Leaky Bucket\n3. Fixed Window Counter\n4. Sliding Window Log / Counter",
        "input_format": "Rate Limiter architectural specification",
        "output_format": "Redis Lua Script / System Design Breakdown",
        "starter_code": "### Rate Limiter Architecture\n- Algorithm: Token Bucket with Redis\n- Redis Data Structure: Hash or Sorted Set (ZSET)\n\n```python\nimport time\n\nclass TokenBucket:\n    def __init__(self, capacity, refill_rate):\n        self.capacity = capacity\n        self.tokens = capacity\n        self.refill_rate = refill_rate\n        self.last_refill = time.time()\n\n    def allow_request(self):\n        now = time.time()\n        # Refill tokens based on elapsed time\n        self.tokens = min(self.capacity, self.tokens + (now - self.last_refill) * self.refill_rate)\n        self.last_refill = now\n        if self.tokens >= 1:\n            self.tokens -= 1\n            return True\n        return False\n```",
        "editorial": "### Rate Limiter Solution\n\n1. **Token Bucket Algorithm**: Allows burst traffic while maintaining average rate.\n2. **Redis + Lua Script**: Ensures atomic increment and time window check in a single round-trip without race conditions.",
        "hints": [
          "Redis Lua scripts run atomically, avoiding race conditions in multi-threaded app servers.",
          "Sliding Window Counter uses less memory than Sliding Window Log."
        ],
        "test_cases": [
          {
            "input": "105 requests in 60s window (limit=100)",
            "expected": "First 100 requests ALLOWED (200 OK), last 5 requests BLOCKED (429 Too Many Requests)"
          }
        ]
    }
]

# Add Web Dev questions
web_questions = [
    {
        "id": "web-001",
        "domain": "web_dev",
        "topic": "Web Dev & APIs",
        "difficulty": "Medium",
        "companies": ["Meta", "Netflix", "Swiggy"],
        "title": "Implement Debounce Function in JavaScript",
        "description": "Implement a `debounce(fn, delay)` utility function in JavaScript / Node.js. The debounced function delays invoking `fn` until after `delay` milliseconds have elapsed since the last time the debounced function was invoked.",
        "input_format": "fn: function, delay: number in ms",
        "output_format": "Debounced function wrapper",
        "starter_code": "function debounce(fn, delay) {\n  let timer = null;\n  return function (...args) {\n    const context = this;\n    clearTimeout(timer);\n    timer = setTimeout(() => {\n      fn.apply(context, args);\n    }, delay);\n  };\n}\n\n// Test execution\nlet count = 0;\nconst increment = debounce(() => { count++; console.log(count); }, 100);\nincrement();\nincrement();\nincrement();\n// Should only print 1 after delay\n",
        "editorial": "### Debounce Solution\n\nMaintain a `timer` variable in closure. On every invocation, `clearTimeout(timer)` cancels previous pending executions, and a new `setTimeout` is scheduled.\n\n```js\nfunction debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n```",
        "hints": [
          "Use setTimeout and clearTimeout.",
          "Preserve 'this' context and arguments using fn.apply(this, args)."
        ],
        "test_cases": [
          {
            "input": "3 calls triggered within 50ms, delay=100ms",
            "expected": "1"
          }
        ]
    }
]

# Add CS Fundamentals questions
cs_questions = [
    {
        "id": "cs-001",
        "domain": "cs_fundamentals",
        "topic": "CS Fundamentals",
        "difficulty": "Medium",
        "companies": ["TCS", "Infosys", "Wipro", "Amazon"],
        "title": "LRU Cache Implementation",
        "description": "Design a Data Structure for Least Recently Used (LRU) Cache. It should support `get(key)` and `put(key, value)` operations in O(1) average time complexity.\n\n- `get(key)`: Get the value of key if key exists, otherwise return -1.\n- `put(key, value)`: Update or insert key-value pair. When cache reaches capacity, evict the least recently used key before inserting new item.",
        "input_format": "Capacity n, followed by operations",
        "output_format": "Values returned from get calls",
        "starter_code": "class Node:\n    def __init__(self, key=0, val=0):\n        self.key = key\n        self.val = val\n        self.prev = None\n        self.next = None\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cap = capacity\n        self.cache = {}  # key -> Node\n        self.head = Node()\n        self.tail = Node()\n        self.head.next = self.tail\n        self.tail.prev = self.head\n\n    def get(self, key: int) -> int:\n        if key in self.cache:\n            node = self.cache[key]\n            self._remove(node)\n            self._add_to_head(node)\n            return node.val\n        return -1\n\n    def put(self, key: int, value: int) -> None:\n        if key in self.cache:\n            self._remove(self.cache[key])\n        node = Node(key, value)\n        self.cache[key] = node\n        self._add_to_head(node)\n        if len(self.cache) > self.cap:\n            lru = self.tail.prev\n            self._remove(lru)\n            del self.cache[lru.key]\n\n    def _remove(self, node):\n        node.prev.next = node.next\n        node.next.prev = node.prev\n\n    def _add_to_head(self, node):\n        node.next = self.head.next\n        node.prev = self.head\n        self.head.next.prev = node\n        self.head.next = node\n",
        "editorial": "### LRU Cache Solution\n\nCombine a Hash Map (O(1) lookup) with a Doubly Linked List (O(1) insertion/deletion at head/tail).\n\n- `get()` moves accessed node to head.\n- `put()` adds new node to head and evicts node at `tail.prev` if over capacity.",
        "hints": [
          "A Doubly Linked List lets you remove a node in O(1) time if you have reference to it.",
          "A Hash Map stores key -> DoublyLinkedListNode."
        ],
        "test_cases": [
          {
            "input": "put(1, 1), put(2, 2), get(1), put(3, 3), get(2)",
            "expected": "1\n-1"
          }
        ]
    }
]

# Merge into questions list
existing_ids = {q["id"] for q in questions}
for nq in sql_questions + sd_questions + web_questions + cs_questions:
    if nq["id"] not in existing_ids:
        questions.append(nq)

with open(DSA_FILE, "w", encoding="utf-8") as f:
    json.dump(questions, f, indent=2, ensure_ascii=False)

print(f"Successfully enriched {len(questions)} questions across all domains!")

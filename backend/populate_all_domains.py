import json

sql_questions = [
    {
        "id": "sql-003",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Amazon", "Google", "Microsoft"],
        "title": "Second Highest Salary",
        "description": "Write an SQL query to find the second highest salary from the Employee table. If there is no second highest salary, return NULL.",
        "input_format": "Table: Employee (id INT, salary INT)",
        "output_format": "Second highest salary value",
        "starter_code": "-- Write your SQL query below\nSELECT DISTINCT salary \nFROM Employee \nORDER BY salary DESC \nLIMIT 1 OFFSET 1;",
        "editorial": "### Solution\nUse `ORDER BY salary DESC LIMIT 1 OFFSET 1` to skip the highest salary and fetch the second highest.",
        "hints": [
            "Use OFFSET 1 with LIMIT 1.",
            "Use DISTINCT to handle ties."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 100), (2, 200), (3, 300);",
                "expected": "200"
            }
        ]
    },
    {
        "id": "sql-004",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Meta", "Apple"],
        "title": "Nth Highest Salary",
        "description": "Write an SQL query to report the 3rd highest distinct salary from the Employee table.",
        "input_format": "Table: Employee (id INT, salary INT)",
        "output_format": "3rd Highest Salary",
        "starter_code": "-- Write your SQL query below\nSELECT DISTINCT salary \nFROM Employee \nORDER BY salary DESC \nLIMIT 1 OFFSET 2;",
        "editorial": "### Solution\nTo get Nth highest salary, set OFFSET to N-1 (OFFSET 2 for 3rd highest).",
        "hints": [
            "OFFSET is 0-indexed.",
            "For 3rd highest, skip 2 rows."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 100), (2, 200), (3, 300), (4, 400);",
                "expected": "200"
            }
        ]
    },
    {
        "id": "sql-005",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Amazon", "Apple"],
        "title": "Customers Who Never Order",
        "description": "Write an SQL query to find all customers who never ordered anything.",
        "input_format": "Tables: Customers (id, name), Orders (id, customerId)",
        "output_format": "Customer names who placed no orders",
        "starter_code": "-- Write your SQL query below\nSELECT name \nFROM Customers \nWHERE id NOT IN (SELECT customerId FROM Orders WHERE customerId IS NOT NULL);",
        "editorial": "### Solution\nUse `LEFT JOIN` or `NOT IN` to identify customer IDs missing from the Orders table.",
        "hints": [
            "You can use LEFT JOIN and filter WHERE Orders.id IS NULL.",
            "Or use NOT IN with subquery."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Customers (id INT, name TEXT);\nCREATE TABLE Orders (id INT, customerId INT);\nINSERT INTO Customers VALUES (1, 'Joe'), (2, 'Henry'), (3, 'Sam'), (4, 'Max');\nINSERT INTO Orders VALUES (1, 3), (2, 1);",
                "expected": "Henry\nMax"
            }
        ]
    },
    {
        "id": "sql-006",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Uber", "Google"],
        "title": "Employees Earning More Than Their Managers",
        "description": "Write an SQL query to find the employees who earn more than their managers.",
        "input_format": "Table: Employee (id INT, name TEXT, salary INT, managerId INT)",
        "output_format": "Names of employees earning more than manager",
        "starter_code": "-- Write your SQL query below\nSELECT e.name \nFROM Employee e \nJOIN Employee m ON e.managerId = m.id \nWHERE e.salary > m.salary;",
        "editorial": "### Solution\nSelf-join the Employee table on `e.managerId = m.id` and compare `e.salary > m.salary`.",
        "hints": [
            "Use a self join.",
            "Alias Employee as e and manager as m."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Employee (id INT, name TEXT, salary INT, managerId INT);\nINSERT INTO Employee VALUES (1, 'Joe', 70000, 3), (2, 'Henry', 80000, 4), (3, 'Sam', 60000, NULL), (4, 'Max', 90000, NULL);",
                "expected": "Joe"
            }
        ]
    },
    {
        "id": "sql-007",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Adobe", "Oracle"],
        "title": "Duplicate Emails",
        "description": "Write an SQL query to report all duplicate emails.",
        "input_format": "Table: Person (id INT, email TEXT)",
        "output_format": "Duplicate emails",
        "starter_code": "-- Write your SQL query below\nSELECT email \nFROM Person \nGROUP BY email \nHAVING COUNT(email) > 1;",
        "editorial": "### Solution\nGroup by `email` and filter using `HAVING COUNT(email) > 1`.",
        "hints": [
            "Use GROUP BY email.",
            "Use HAVING COUNT(*) > 1."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Person (id INT, email TEXT);\nINSERT INTO Person VALUES (1, 'a@b.com'), (2, 'c@d.com'), (3, 'a@b.com');",
                "expected": "a@b.com"
            }
        ]
    },
    {
        "id": "sql-008",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Microsoft", "Cisco"],
        "title": "Delete Duplicate Emails",
        "description": "Write an SQL deletion query to remove duplicate emails, keeping only one unique email with the smallest id.",
        "input_format": "Table: Person (id INT, email TEXT)",
        "output_format": "Remaining Person table records after deletion",
        "starter_code": "-- Delete duplicate emails keeping smallest id\nDELETE FROM Person \nWHERE id NOT IN (\n    SELECT MIN(id) FROM Person GROUP BY email\n);\nSELECT id, email FROM Person ORDER BY id;",
        "editorial": "### Solution\nDelete rows where ID is not the MIN(id) for that email address.",
        "hints": [
            "Group by email to find MIN(id).",
            "Delete any row whose id is not in that list."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Person (id INT, email TEXT);\nINSERT INTO Person VALUES (1, 'john@example.com'), (2, 'bob@example.com'), (3, 'john@example.com');",
                "expected": "1 john@example.com\n2 bob@example.com"
            }
        ]
    },
    {
        "id": "sql-009",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Amazon", "Meta"],
        "title": "Rising Temperature",
        "description": "Write an SQL query to find all IDs of dates with higher temperatures compared to their previous dates (yesterday).",
        "input_format": "Table: Weather (id INT, recordDate DATE, temperature INT)",
        "output_format": "IDs with higher temperature than yesterday",
        "starter_code": "-- Write your SQL query below\nSELECT w1.id \nFROM Weather w1 \nJOIN Weather w2 \n  ON JULIANDAY(w1.recordDate) - JULIANDAY(w2.recordDate) = 1 \nWHERE w1.temperature > w2.temperature;",
        "editorial": "### Solution\nJoin Weather table with itself where date difference is 1 day and w1.temperature > w2.temperature.",
        "hints": [
            "Compare recordDate using date math.",
            "Use JULIANDAY in SQLite."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Weather (id INT, recordDate DATE, temperature INT);\nINSERT INTO Weather VALUES (1, '2015-01-01', 10), (2, '2015-01-02', 25), (3, '2015-01-03', 20), (4, '2015-01-04', 30);",
                "expected": "2\n4"
            }
        ]
    },
    {
        "id": "sql-010",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Google", "Goldman Sachs"],
        "title": "Department Highest Salary",
        "description": "Write an SQL query to find employees who have the highest salary in each of the departments.",
        "input_format": "Tables: Department (id, name), Employee (id, name, salary, departmentId)",
        "output_format": "Department Name, Employee Name, Salary",
        "starter_code": "-- Write your SQL query below\nSELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON e.departmentId = d.id\nWHERE (e.departmentId, e.salary) IN (\n    SELECT departmentId, MAX(salary)\n    FROM Employee\n    GROUP BY departmentId\n);",
        "editorial": "### Solution\nFilter Employee table where tuple `(departmentId, salary)` matches `(departmentId, MAX(salary))` from subquery.",
        "hints": [
            "Group by departmentId to find MAX(salary).",
            "Join with Department table for department names."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Department (id INT, name TEXT);\nCREATE TABLE Employee (id INT, name TEXT, salary INT, departmentId INT);\nINSERT INTO Department VALUES (1, 'IT'), (2, 'Sales');\nINSERT INTO Employee VALUES (1, 'Joe', 85000, 1), (2, 'Henry', 80000, 2), (3, 'Sam', 60000, 2), (4, 'Max', 90000, 1);",
                "expected": "Sales Henry 80000\nIT Max 90000"
            }
        ]
    },
    {
        "id": "sql-011",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Amazon", "Bloomberg"],
        "title": "Rank Scores",
        "description": "Write an SQL query to rank the scores in descending order. If there is a tie between two scores, both should have the same ranking. Rank should be a continuous integer (DENSE_RANK).",
        "input_format": "Table: Scores (id INT, score REAL)",
        "output_format": "score, rank",
        "starter_code": "-- Write your SQL query below\nSELECT score, DENSE_RANK() OVER (ORDER BY score DESC) AS rank \nFROM Scores;",
        "editorial": "### Solution\nUse `DENSE_RANK() OVER (ORDER BY score DESC)` window function.",
        "hints": [
            "Use window functions.",
            "DENSE_RANK produces contiguous ranks without gaps."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Scores (id INT, score REAL);\nINSERT INTO Scores VALUES (1, 3.50), (2, 3.65), (3, 4.00), (4, 3.85), (5, 4.00), (6, 3.65);",
                "expected": "4.0 1\n4.0 1\n3.85 2\n3.65 3\n3.65 3\n3.5 4"
            }
        ]
    },
    {
        "id": "sql-012",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Meta", "Twitter"],
        "title": "Consecutive Numbers",
        "description": "Write an SQL query to find all numbers that appear at least three times consecutively in the Logs table.",
        "input_format": "Table: Logs (id INT, num INT)",
        "output_format": "Distinct consecutive numbers",
        "starter_code": "-- Write your SQL query below\nSELECT DISTINCT l1.num \nFROM Logs l1\nJOIN Logs l2 ON l1.id = l2.id - 1\nJOIN Logs l3 ON l1.id = l3.id - 2\nWHERE l1.num = l2.num AND l2.num = l3.num;",
        "editorial": "### Solution\nSelf-join Logs table 3 times on `id = id - 1` and `id = id - 2` and check `l1.num = l2.num = l3.num`.",
        "hints": [
            "Join logs with offset IDs (id+1, id+2).",
            "Filter where all 3 values are equal."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Logs (id INT, num INT);\nINSERT INTO Logs VALUES (1, 1), (2, 1), (3, 1), (4, 2), (5, 1), (6, 2), (7, 2);",
                "expected": "1"
            }
        ]
    },
    {
        "id": "sql-013",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Stripe", "Uber"],
        "title": "Exchange Seats",
        "description": "Write an SQL query to swap the seat id of every two consecutive students. If the number of students is odd, the id of the last student is not swapped.",
        "input_format": "Table: Seat (id INT, student TEXT)",
        "output_format": "Reordered seat id and student name",
        "starter_code": "-- Write your SQL query below\nSELECT \n  CASE \n    WHEN id % 2 = 1 AND id = (SELECT MAX(id) FROM Seat) THEN id\n    WHEN id % 2 = 1 THEN id + 1\n    ELSE id - 1\n  END AS id, student\nFROM Seat\nORDER BY id;",
        "editorial": "### Solution\nUse a CASE statement to swap odd IDs (`id + 1`) and even IDs (`id - 1`), preserving the max ID if total count is odd.",
        "hints": [
            "Odd IDs become id+1, Even IDs become id-1.",
            "Check if odd ID is the last ID."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Seat (id INT, student TEXT);\nINSERT INTO Seat VALUES (1, 'Abbot'), (2, 'Doris'), (3, 'Emerson'), (4, 'Green'), (5, 'Jeames');",
                "expected": "1 Doris\n2 Abbot\n3 Green\n4 Emerson\n5 Jeames"
            }
        ]
    },
    {
        "id": "sql-014",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Uber", "Twitter"],
        "title": "Tree Node Classification",
        "description": "Each node in a binary tree can be 'Root', 'Inner', or 'Leaf'. Write an SQL query to report the classification of each node.",
        "input_format": "Table: Tree (id INT, p_id INT)",
        "output_format": "id, node_type ('Root', 'Inner', 'Leaf')",
        "starter_code": "-- Write your SQL query below\nSELECT id,\n  CASE\n    WHEN p_id IS NULL THEN 'Root'\n    WHEN id IN (SELECT p_id FROM Tree WHERE p_id IS NOT NULL) THEN 'Inner'\n    ELSE 'Leaf'\n  END AS type\nFROM Tree\nORDER BY id;",
        "editorial": "### Solution\n- `p_id IS NULL` => Root\n- `id IN (p_id subquery)` => Inner\n- Else => Leaf",
        "hints": [
            "Check p_id IS NULL for Root.",
            "Check if id is a parent of another node for Inner."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Tree (id INT, p_id INT);\nINSERT INTO Tree VALUES (1, NULL), (2, 1), (3, 1), (4, 2), (5, 2);",
                "expected": "1 Root\n2 Inner\n3 Leaf\n4 Leaf\n5 Leaf"
            }
        ]
    },
    {
        "id": "sql-015",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Medium",
        "companies": ["Robinhood", "Stripe"],
        "title": "Capital Gain/Loss",
        "description": "Write an SQL query to report the Capital Gain/Loss for each stock.",
        "input_format": "Table: Stocks (stock_name TEXT, operation TEXT, operation_day INT, price INT)",
        "output_format": "stock_name, capital_gain_loss",
        "starter_code": "-- Write your SQL query below\nSELECT stock_name, \n  SUM(CASE WHEN operation = 'Sell' THEN price ELSE -price END) AS capital_gain_loss\nFROM Stocks\nGROUP BY stock_name;",
        "editorial": "### Solution\nSum up price conditionally: `Sell` adds price (`+price`), `Buy` subtracts price (`-price`).",
        "hints": [
            "Use SUM with CASE statement.",
            "Buy is negative, Sell is positive."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Stocks (stock_name TEXT, operation TEXT, operation_day INT, price INT);\nINSERT INTO Stocks VALUES ('Corona', 'Buy', 1, 10), ('Corona', 'Sell', 2, 50), ('LeetCode', 'Buy', 1, 1000), ('LeetCode', 'Sell', 2, 9000);",
                "expected": "Corona 40\nLeetCode 8000"
            }
        ]
    },
    {
        "id": "sql-016",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Easy",
        "companies": ["Amazon", "Apple"],
        "title": "Reformat Department Table",
        "description": "Reformat the Department table such that there is a department id column and a revenue column for Jan, Feb, Mar.",
        "input_format": "Table: Department (id INT, revenue INT, month TEXT)",
        "output_format": "id, Jan_Revenue, Feb_Revenue, Mar_Revenue",
        "starter_code": "-- Write your SQL query below\nSELECT id,\n  SUM(CASE WHEN month = 'Jan' THEN revenue ELSE NULL END) AS Jan_Revenue,\n  SUM(CASE WHEN month = 'Feb' THEN revenue ELSE NULL END) AS Feb_Revenue,\n  SUM(CASE WHEN month = 'Mar' THEN revenue ELSE NULL END) AS Mar_Revenue\nFROM Department\nGROUP BY id;",
        "editorial": "### Solution\nPivot rows into columns using `SUM(CASE WHEN month = 'X' THEN revenue END)` grouped by `id`.",
        "hints": [
            "Pivot using conditional aggregation.",
            "Group by department id."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Department (id INT, revenue INT, month TEXT);\nINSERT INTO Department VALUES (1, 8000, 'Jan'), (1, 7000, 'Feb'), (1, 6000, 'Mar');",
                "expected": "1 8000 7000 6000"
            }
        ]
    },
    {
        "id": "sql-017",
        "domain": "sql",
        "topic": "SQL & Databases",
        "difficulty": "Hard",
        "companies": ["Twitter", "Meta"],
        "title": "Investments in 2016",
        "description": "Report the sum of all total investment values in 2016 (tiv_2016) for policyholders who have the same tiv_2015 value as one or more policyholders, and are NOT located in the same city (lat, lon pair) as any other policyholder.",
        "input_format": "Table: Insurance (pid INT, tiv_2015 REAL, tiv_2016 REAL, lat REAL, lon REAL)",
        "output_format": "Sum of tiv_2016",
        "starter_code": "-- Write your SQL query below\nSELECT ROUND(SUM(tiv_2016), 2) AS tiv_2016\nFROM Insurance\nWHERE tiv_2015 IN (\n    SELECT tiv_2015 FROM Insurance GROUP BY tiv_2015 HAVING COUNT(*) > 1\n)\nAND (lat, lon) IN (\n    SELECT lat, lon FROM Insurance GROUP BY lat, lon HAVING COUNT(*) = 1\n);",
        "editorial": "### Solution\nCheck `tiv_2015` appears > 1 time AND `(lat, lon)` tuple appears exactly 1 time.",
        "hints": [
            "Use subqueries with HAVING COUNT(*) > 1 and HAVING COUNT(*) = 1.",
            "Sum tiv_2016 of matching rows."
        ],
        "test_cases": [
            {
                "input": "CREATE TABLE Insurance (pid INT, tiv_2015 REAL, tiv_2016 REAL, lat REAL, lon REAL);\nINSERT INTO Insurance VALUES (1, 10, 5, 10, 10), (2, 20, 20, 20, 20), (3, 10, 30, 20, 20), (4, 10, 40, 40, 40);",
                "expected": "45.0"
            }
        ]
    }
]

system_design_questions = [
    {
        "id": f"sd-00{i+3}",
        "domain": "system_design",
        "topic": "System Design",
        "difficulty": "Hard" if i % 2 == 0 else "Medium",
        "companies": [c1, c2, c3],
        "title": title,
        "description": desc,
        "input_format": "Architectural breakdown & system specification",
        "output_format": "High-Level Architecture & Component Design",
        "starter_code": starter,
        "editorial": ed,
        "hints": hints,
        "test_cases": [{"input": test_in, "expected": test_out}]
    }
    for i, (title, desc, starter, ed, hints, test_in, test_out, c1, c2, c3) in enumerate([
        ("Design Twitter / X News Feed", "Design Twitter news feed system where users post tweets, follow users, and render a personalized timeline of top 800 recent tweets from followed users.", "### 1. High-Level Architecture\n- Load Balancer -> Web Gateway -> Feed Service\n- Redis Fanout-on-Write (Push model for active users) & Fanout-on-Read (Pull model for celebrities)", "### Solution\n1. **Fanout Service**: Push tweets to Redis timelines of active followers.\n2. **Hybrid Fanout**: For users with >10,000 followers (celebrities), pull tweets at read time to prevent write amplification.", ["Push model for normal users, Pull model for celebrities.", "Redis Sorted Sets (ZSET) indexed by timestamp."], "post_tweet(user_id=1, text='Hello World')", "Status 200: Tweet published & pushed to Redis timelines", "Meta", "Twitter", "Netflix"),
        ("Design WhatsApp / Real-time Chat System", "Design a scalable 1-on-1 and group messaging system handling millions of concurrent WebSocket connections with delivery receipts (Sent, Delivered, Read).", "### 1. High-Level Architecture\n- WebSockets (Netty/Go) with Gateway Cluster\n- Presence Service + Message Storage (Cassandra / DynamoDB)\n- Offline Message Queue (Kafka/RabbitMQ)", "### Solution\n1. **Session Service**: Keeps mapping of `user_id -> websocket_server_ip`.\n2. **Message Persistence**: Store messages in Cassandra for fast time-series writes.", ["Use WebSockets for bidirectional low-latency transport.", "Store undelivered messages in a persistent MQ until client reconnects."], "send_message(from=101, to=102, body='Hey')", "Ack Delivered: Message saved to DB and pushed via WebSocket", "Meta", "Google", "Discord"),
        ("Design Distributed Web Crawler", "Design a scalable distributed web crawler to crawl billions of web pages per day, handle duplicate URLs, politeness, and robot.txt rules.", "### 1. High-Level Architecture\n- URL Frontier (Priority Queue + Politeness Queue)\n- HTML Fetcher -> DNS Resolver -> Content Parser -> Deduplication (Bloom Filter)\n- Document Storage (S3 / HDFS)", "### Solution\n1. **Bloom Filter**: Instant URL deduplication.\n2. **Politeness**: Limit requests per domain using domain queues.", ["Use Bloom Filter to prevent re-crawling URLs.", "Maintain host-level queues for politeness delay."], "crawl(seed_urls=['https://wikipedia.org'])", "Queued 10,000 URLs, Filtered 1,200 duplicates via Bloom Filter", "Google", "Bing", "DuckDuckGo"),
        ("Design Video Streaming Service (Netflix/YouTube)", "Design a video streaming and encoding pipeline supporting adaptive bitrate streaming (HLS/DASH) across global CDNs.", "### 1. High-Level Architecture\n- Client Upload -> Blob Store (S3) -> Transcoder (AWS Elemental / FFmpeg)\n- HLS Manifest Generator (1080p, 720p, 480p, 360p)\n- CDN Edge Caching (Cloudflare / Fastly)", "### Solution\n1. **Transcoding Pipeline**: Segment videos into 2-6 sec chunk files at multiple resolutions.\n2. **CDN Delivery**: Cache video chunks near users.", ["Split videos into 2-6 second chunks.", "Use Adaptive Bitrate Streaming (HLS / DASH)."], "upload_video(file='movie.mp4')", "Transcoded to 4 HLS variants (1080p, 720p, 480p, 360p) & CDN distributed", "Netflix", "YouTube", "Twitch"),
        ("Design Distributed Key-Value Store", "Design a highly available distributed key-value store (like DynamoDB / Cassandra) supporting tunable consistency (CAP Theorem).", "### 1. High-Level Architecture\n- Consistent Hashing Ring with Virtual Nodes\n- Vector Clocks for Conflict Resolution\n- Gossip Protocol for Node Heartbeats", "### Solution\n1. **Consistent Hashing**: Distribute keys evenly across cluster nodes.\n2. **Quorum Read/Write**: $R + W > N$ guarantees strong consistency.", ["Use Virtual Nodes on Consistent Hash Ring for load balance.", "Gossip protocol for decentralized cluster membership."], "put(key='user_10', val='data')", "Replicated across N=3 nodes on Hash Ring with W=2 Quorum", "Amazon", "Redis", "Cassandra"),
        ("Design Uber / Lyft Ride Hailing Service", "Design a real-time location tracking and driver-rider matching platform handling spatial queries across millions of active drivers.", "### 1. High-Level Architecture\n- Geo-Location Service: Geospatial Indexing (Geohash / Google S2)\n- Driver Location Ingestion (Kafka -> Redis)\n- Match Service: QuadTree spatial lookup within 3km radius", "### Solution\n1. **Geohash**: Map lat/lon coordinates into 6-character spatial string.\n2. **Redis Geospatial**: `GEOADD` and `GEORADIUS` for fast proximity search.", ["Use Geohash or Google S2 geometry library.", "Buffer location pings via Kafka before updating spatial index."], "request_ride(pickup_lat=37.77, pickup_lon=-122.41)", "Matched Driver ID #492 within 1.2km (Geohash 9q9hv)", "Uber", "Lyft", "Grab"),
        ("Design E-Commerce Flash Sale System", "Design an e-commerce flash sale system handling 1,000,000 requests/sec for limited inventory (e.g. 100 iPhone units).", "### 1. High-Level Architecture\n- CDN static asset caching -> Rate Limiter -> Inventory Redis Pre-decr\n- Kafka Order Creation Queue -> Async DB Persistence (PostgreSQL)\n- Anti-Bot / Captcha Engine", "### Solution\n1. **Redis Atomic Decr**: `DECRBY inventory 1` prevents race conditions.\n2. **Async Order Queue**: Decouple purchase validation from DB write.", ["Perform inventory decrement atomically in Redis.", "Use Kafka queue to process DB order creation asynchronously."], "buy_item(item_id=1, user_id=88)", "Redis DECR: Inventory remaining=99. Order task pushed to Kafka", "Amazon", "Flipkart", "Alibaba"),
        ("Design Notification System", "Design a multi-channel notification engine (iOS APNS, Android FCM, Email SES, SMS Twilio) delivering billions of alerts daily.", "### 1. High-Level Architecture\n- Notification API Service -> Message Router\n- Priority Queues (High/Low) via RabbitMQ / Kafka\n- Channel Workers (FCM Worker, APNS Worker, SMS Worker)", "### Solution\n1. **Rate Limiting & Deduplication**: Filter repeated push notifications within 5 mins.\n2. **Async Channel Workers**: Workers consume tasks from dedicated queues.", ["Separate high-priority OTP notifications from low-priority marketing.", "Implement automatic fallback channels (Push -> SMS)."], "send_notification(user_id=45, type='OTP', msg='123456')", "Enqueued to High-Priority OTP Queue -> Sent via Twilio SMS in 120ms", "Meta", "Airbnb", "Apple"),
        ("Design Distributed Unique ID Generator", "Design a 64-bit unique ID generator service (Snowflake) capable of generating 10,000+ IDs per millisecond in chronological order.", "### 1. High-Level Architecture\n- 1 bit (Unused)\n- 41 bits (Timestamp in ms)\n- 10 bits (Datacenter ID + Worker Machine ID)\n- 12 bits (Sequence counter: 0-4095 per ms)", "### Solution\n1. **Snowflake Bit Breakdown**: Timestamp (41b) + Machine ID (10b) + Sequence (12b).\n2. **Clock Sync**: Handle NTP clock drift gracefully.", ["41 bits timestamp gives 69 years of IDs.", "12 bits sequence allows 4096 IDs per ms per worker."], "generate_id()", "Returns 64-bit BigInt: 1541892019481903104", "Twitter", "Discord", "Square"),
        ("Design Search Autocomplete / Typeahead", "Design a search autocomplete service delivering real-time prefix suggestions within <50ms response latency.", "### 1. High-Level Architecture\n- Trie Data Structure with top 5 nodes cached at each Trie node\n- Offline Analytics Pipeline (Spark / Hadoop) calculating keyword frequencies\n- In-Memory Redis Trie Cache", "### Solution\n1. **Trie with Top K Cache**: Store top 5 frequent queries inside each Trie node to avoid tree traversal at runtime.", ["Cache top K search terms inside each Trie node.", "Use Spark offline job to update prefix weights every hour."], "autocomplete(prefix='app')", "Returns ['apple', 'apple store', 'apple watch', 'app store'] in 8ms", "Google", "Amazon", "Microsoft"),
        ("Design E-Mail System (Gmail)", "Design a scalable cloud email platform handling MIME storage, search indexing, and folder management for billions of emails.", "### 1. High-Level Architecture\n- SMTP Gateway -> Spam Filter -> Mail Ingestion Service\n- Storage Engine: Metadata (Cassandra) + Blob Attachments (S3)\n- Search Indexing: Distributed Elasticsearch cluster", "### Solution\n1. **Separate Metadata & Content**: Store email body/attachments in S3 and metadata in Cassandra.\n2. **Async Search Indexing**: Kafka consumer streams incoming emails to Elasticsearch.", ["Store large email attachments in Blob Storage (S3).", "Use Elasticsearch for fast subject/body text queries."], "receive_email(to='user@gmail.com', subject='Receipt')", "Stored blob in S3, metadata in Cassandra, indexed in Elasticsearch", "Google", "Microsoft", "Fastmail"),
        ("Design Cloud Storage System (Google Drive)", "Design a file storage and syncing service supporting block-level chunking, delta syncing, and conflict resolution.", "### 1. High-Level Architecture\n- Block Server (Splits file into 4MB chunks + SHA-256 hash)\n- Synchronization Service (Pushes modified chunks only)\n- Metadata Database (MySQL Sharded) + Blob Storage (S3)", "### Solution\n1. **Delta Sync**: Calculate SHA-256 for 4MB file blocks. Only upload modified blocks.\n2. **Deduplication**: Store duplicate blocks once across all users.", ["Split files into 4MB chunk blocks.", "Deduplicate blocks across system using SHA-256 hash."], "upload_file(name='doc.pdf', size=10MB)", "Split into 3 blocks (4MB, 4MB, 2MB). 2 blocks deduplicated, 1 uploaded.", "Dropbox", "Google", "Box"),
        ("Design Metrics Aggregator & Logging Platform", "Design a log & time-series metrics collection platform (Prometheus / Grafana) processing millions of data points per second.", "### 1. High-Level Architecture\n- Log Collector (Fluentd / Logstash) -> Kafka Buffer\n- Time-Series Database (TSDB like InfluxDB / Prometheus)\n- Aggregator Engine (10s, 1m, 1h rollup windows)", "### Solution\n1. **TSDB Storage**: Write-optimized LSM tree storing `(metric_name, timestamp, value)`.\n2. **Downsampling**: Aggregate raw 1-second metrics into 1-minute historical rollups.", ["Use Time-Series Database optimized for append-only writes.", "Downsample historical metrics to save disk space."], "log_metric(name='cpu_usage', val=84.2, timestamp=1600000000)", "Appended to TSDB write-ahead log & aggregated in 1-min window", "Datadog", "AWS", "Splunk"),
        ("Design Distributed Task Scheduler", "Design a distributed cron and delayed task scheduler (Celery / Quartz) guaranteeing at-least-once execution.", "### 1. High-Level Architecture\n- Scheduler Service (Delay Queue / Hierarchical Timing Wheel)\n- Execution Workers (Go / Python worker pool)\n- Lock Manager (Redis Distributed Lock / ZooKeeper)", "### Solution\n1. **Timing Wheel / Priority Queue**: Store scheduled tasks sorted by target execution timestamp.\n2. **Distributed Lock**: Acquire lock on task ID before execution to prevent duplicate runs.", ["Use Hierarchical Timing Wheel or Redis ZSET for delayed tasks.", "Distributed lock ensures single worker execution."], "schedule_task(task='send_email', delay_secs=300)", "Added to ZSET with score=now+300. Worker executes at target timestamp.", "Airbnb", "Uber", "Lyft"),
        ("Design Collaborative Document Editor (Google Docs)", "Design a real-time collaborative rich-text editor allowing concurrent typing using Operational Transformation (OT) or CRDTs.", "### 1. High-Level Architecture\n- WebSocket Server Cluster\n- Conflict Resolution Engine: CRDT (Conflict-free Replicated Data Type) / OT Engine\n- Document Snapshot Store (Redis + PostgreSQL append log)", "### Solution\n1. **CRDT / OT**: Assign unique immutable IDs to every character position to resolve concurrent typing conflicts without locking.", ["Use CRDT (Yjs / Automerge) for decentralized lock-free editing.", "Store operation log and periodically generate document snapshots."], "apply_op(user_id=2, insert='A', pos=14)", "CRDT merged operational change seamlessly across 12 connected clients", "Google", "Figma", "Notion")
    ])
]

web_dev_questions = [
    {
        "id": f"web-00{i+2}",
        "domain": "web_dev",
        "topic": "Web Dev & APIs",
        "difficulty": "Easy" if i in [0, 1, 3, 11, 13] else ("Hard" if i in [7, 8, 9] else "Medium"),
        "companies": [c1, c2, c3],
        "title": title,
        "description": desc,
        "input_format": "Function parameters / JS specs",
        "output_format": "Execution output / Polyfill return",
        "starter_code": starter,
        "editorial": ed,
        "hints": hints,
        "test_cases": [{"input": test_in, "expected": test_out}]
    }
    for i, (title, desc, starter, ed, hints, test_in, test_out, c1, c2, c3) in enumerate([
        ("Implement Throttle Function", "Implement a `throttle(fn, limit)` utility in JavaScript. The throttled function will execute `fn` at most once every `limit` milliseconds.", "function throttle(fn, limit) {\n  let inThrottle = false;\n  return function (...args) {\n    if (!inThrottle) {\n      fn.apply(this, args);\n      inThrottle = true;\n      setTimeout(() => inThrottle = false, limit);\n    }\n  };\n}\nlet count = 0;\nconst run = throttle(() => count++, 100);\nrun(); run(); run();\nconsole.log(count);", "### Solution\nMaintain a boolean flag `inThrottle`. Execute `fn` immediately on first call and lock execution until timeout expires.", ["Execute immediately on first invocation.", "Use a flag boolean variable to lock subsequent calls."], "Trigger 3 calls at t=0ms with 100ms throttle", "1", "Meta", "Netflix", "Swiggy"),
        ("Custom Promise.all Polyfill", "Implement a polyfill for `Promise.all(promises)`. Return a Promise that resolves to an array of results or rejects on first error.", "function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    let results = [];\n    let completed = 0;\n    if (promises.length === 0) return resolve([]);\n    promises.forEach((p, i) => {\n      Promise.resolve(p).then(res => {\n        results[i] = res;\n        completed++;\n        if (completed === promises.length) resolve(results);\n      }).catch(reject);\n    });\n  });\n}\n\npromiseAll([Promise.resolve(1), Promise.resolve(2)]).then(res => console.log(res.join(',')));", "### Solution\nTrack completed promises count and array index to preserve output order.", ["Store results by original index `results[i] = res`.", "Reject immediately if any promise catches an error."], "promiseAll([Promise.resolve(1), Promise.resolve(2)])", "1,2", "Google", "Amazon", "Flipkart"),
        ("Deep Clone JavaScript Object", "Write a function `deepClone(obj)` that creates a deep copy of a nested JavaScript object/array without reference sharing.", "function deepClone(obj) {\n  if (obj === null || typeof obj !== 'object') return obj;\n  if (Array.isArray(obj)) return obj.map(deepClone);\n  const copy = {};\n  for (let key in obj) {\n    if (Object.prototype.hasOwnProperty.call(obj, key)) {\n      copy[key] = deepClone(obj[key]);\n    }\n  }\n  return copy;\n}\nconst a = { x: 1, y: { z: 2 } };\nconst b = deepClone(a);\nb.y.z = 99;\nconsole.log(a.y.z, b.y.z);", "### Solution\nUse recursion to clone nested objects and arrays while handling primitive values.", ["Check for null and non-object types.", "Recursively map arrays and copy object keys."], "deepClone({ a: { b: 10 } })", "2 99", "Microsoft", "Meta", "Uber"),
        ("Array.prototype.flat Polyfill", "Implement a polyfill for `Array.prototype.flat(depth)`. Recursively flatten array up to specified depth.", "function customFlat(arr, depth = 1) {\n  return depth > 0\n    ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? customFlat(val, depth - 1) : val), [])\n    : arr.slice();\n}\nconsole.log(customFlat([1, [2, [3]]], 2).join(','));", "### Solution\nUse `Array.prototype.reduce` and recursion, decrementing `depth` on each level.", ["Use Array.isArray to check nested elements.", "Decrement depth recursively."], "customFlat([1, [2, [3]]], 2)", "1,2,3", "Meta", "Uber", "Airbnb"),
        ("PubSub / Event Emitter Pattern", "Implement an `EventEmitter` class with `subscribe(event, callback)` and `emit(event, ...args)` methods.", "class EventEmitter {\n  constructor() {\n    this.events = {};\n  }\n  subscribe(event, cb) {\n    if (!this.events[event]) this.events[event] = [];\n    this.events[event].push(cb);\n    return { unsubscribe: () => this.events[event] = this.events[event].filter(fn => fn !== cb) };\n  }\n  emit(event, ...args) {\n    if (this.events[event]) this.events[event].forEach(cb => cb(...args));\n  }\n}\nconst ee = new EventEmitter();\nee.subscribe('login', name => console.log('Welcome ' + name));\nee.emit('login', 'Alice');", "### Solution\nMaintain a hash map of event names to listener arrays.", ["Use a map of arrays for event callbacks.", "Return an unsubscribe handle object."], "ee.subscribe('test', cb); ee.emit('test', 'Hello')", "Welcome Alice", "Apple", "ByteDance", "Atlassian"),
        ("Custom Fetch Wrapper with Auto-Retry", "Implement an async function `fetchWithRetry(url, options, retries = 3)` that automatically retries failed HTTP requests.", "async function fetchWithRetry(fn, retries = 3) {\n  try {\n    return await fn();\n  } catch (err) {\n    if (retries <= 1) throw err;\n    return await fetchWithRetry(fn, retries - 1);\n  }\n}\nlet attempt = 0;\nfetchWithRetry(async () => {\n  attempt++;\n  if (attempt < 3) throw new Error('Network error');\n  return 'Success';\n}, 3).then(res => console.log(res, 'Attempt:', attempt));", "### Solution\nUse a try/catch block inside async function and recursively retry until retries count reaches zero.", ["Catch error and check retries count.", "Add exponential backoff delay if needed."], "fetchWithRetry fails 2 times then succeeds", "Success Attempt: 3", "Airbnb", "Stripe", "PayPal"),
        ("Interceptor Pattern for Axios / Fetch", "Implement a HTTP Client class supporting Request and Response Interceptor middleware pipelines.", "class HttpClient {\n  constructor() {\n    this.requestInterceptors = [];\n    this.responseInterceptors = [];\n  }\n  useRequest(fn) { this.requestInterceptors.push(fn); }\n  useResponse(fn) { this.responseInterceptors.push(fn); }\n  async request(config) {\n    let conf = config;\n    for (let fn of this.requestInterceptors) conf = await fn(conf);\n    let res = { status: 200, data: 'OK for ' + conf.url };\n    for (let fn of this.responseInterceptors) res = await fn(res);\n    return res;\n  }\n}\nconst client = new HttpClient();\nclient.useRequest(c => ({ ...c, headers: { Authorization: 'Bearer 123' } }));\nclient.request({ url: '/api/data' }).then(r => console.log(r.status, r.data));", "### Solution\nPipe request config through `requestInterceptors` and response payload through `responseInterceptors`.", ["Chain promises or execute async loops over interceptor arrays.", "Modify headers or data along the pipeline."], "client.request({ url: '/api/data' })", "200 OK for /api/data", "Swiggy", "Razorpay", "Postman"),
        ("JWT Token Verification & Auth Middleware", "Implement a Node.js / Express style JWT authorization middleware function.", "function authMiddleware(req, res, next) {\n  const authHeader = req.headers['authorization'];\n  if (!authHeader || !authHeader.startsWith('Bearer ')) {\n    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });\n  }\n  const token = authHeader.split(' ')[1];\n  if (token === 'valid_secret_token') {\n    req.user = { id: 1, role: 'admin' };\n    return next();\n  }\n  return res.status(403).json({ error: 'Forbidden: Invalid token' });\n}\n// Mock execution\nauthMiddleware({ headers: { authorization: 'Bearer valid_secret_token' } }, { status: () => ({ json: console.log }) }, () => console.log('NEXT_CALLED'));", "### Solution\nExtract `Bearer` token from `Authorization` header, verify validity, attach `req.user`, and call `next()`.", ["Check header starts with Bearer.", "Return 401 for missing header, 403 for invalid token."], "authMiddleware with valid Bearer token", "NEXT_CALLED", "Auth0", "Okta", "Amazon"),
        ("Rate Limiting Express Middleware", "Implement a sliding window rate limiter middleware restricting IPs to N requests per window.", "class MemoryRateLimiter {\n  constructor(limit, windowMs) {\n    this.limit = limit;\n    this.windowMs = windowMs;\n    this.hits = new Map();\n  }\n  handle(ip) {\n    const now = Date.now();\n    const timestamps = (this.hits.get(ip) || []).filter(t => now - t < this.windowMs);\n    if (timestamps.length >= this.limit) return false;\n    timestamps.push(now);\n    this.hits.set(ip, timestamps);\n    return true;\n  }\n}\nconst limiter = new MemoryRateLimiter(2, 1000);\nconsole.log(limiter.handle('127.0.0.1'), limiter.handle('127.0.0.1'), limiter.handle('127.0.0.1'));", "### Solution\nStore request timestamps in memory map per IP, filtering out records older than window duration.", ["Filter timestamps where `now - t < windowMs`.", "Block if array length >= limit."], "3 requests for limit=2", "true true false", "Cloudflare", "Fastly", "DigitalOcean"),
        ("Virtualized List Rendering Calculation", "Calculate visible item indices `[startIndex, endIndex]` for a virtualized scrolling list given container height, item height, and scrollTop.", "function getVirtualBounds(scrollTop, containerHeight, itemHeight, totalItems, buffer = 2) {\n  let startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);\n  let endIndex = Math.min(totalItems - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);\n  return [startIndex, endIndex];\n}\nconsole.log(getVirtualBounds(200, 300, 50, 100, 1).join(','));", "### Solution\nDivide `scrollTop` by `itemHeight` to find top index and `(scrollTop + height)` for bottom index.", ["Use Math.floor for top item.", "Add buffer items to avoid scroll flickering."], "getVirtualBounds(scrollTop=200, containerHeight=300, itemHeight=50)", "3,11", "Meta", "LinkedIn", "Salesforce"),
        ("React Custom Hook useLocalStorage", "Implement a JavaScript helper simulating React `useLocalStorage(key, initialValue)` hook state manager.", "function createLocalStorageHook(key, initialValue) {\n  let storage = {};\n  return {\n    getValue: () => storage[key] !== undefined ? storage[key] : initialValue,\n    setValue: (val) => { storage[key] = val; }\n  };\n}\nconst hook = createLocalStorageHook('theme', 'dark');\nconsole.log(hook.getValue());\nhook.setValue('light');\nconsole.log(hook.getValue());", "### Solution\nInitialize state from localStorage (or fallback value) and update localStorage on change.", ["Parse JSON on read.", "Stringify JSON on write."], "useLocalStorage('theme', 'dark')", "dark\nlight", "Vercel", "Shopify", "Netlify"),
        ("CORS Header Configuration Spec", "Write a CORS headers generator function returning appropriate Access-Control response headers.", "function getCorsHeaders(origin, allowedOrigins = ['https://app.example.com']) {\n  const isAllowed = allowedOrigins.includes(origin);\n  return {\n    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',\n    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',\n    'Access-Control-Allow-Headers': 'Content-Type, Authorization',\n    'Access-Control-Allow-Credentials': 'true'\n  };\n}\nconsole.log(getCorsHeaders('https://app.example.com')['Access-Control-Allow-Origin']);", "### Solution\nVerify incoming origin against whitelist and dynamically return `Access-Control-Allow-Origin`.", ["Never use wildcard '*' with credentials.", "Handle HTTP OPTIONS preflight request."], "getCorsHeaders('https://app.example.com')", "https://app.example.com", "AWS", "Stripe", "Cloudflare"),
        ("CSS Flexbox Centering Spec", "Demonstrate exact CSS declarations to perfectly center a child element inside a flex container.", "const flexCenterCSS = `\n.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n}\n`;\nconsole.log(flexCenterCSS.includes('justify-content: center') && flexCenterCSS.includes('align-items: center'));", "### Solution\nCombine `display: flex`, `justify-content: center` (main axis), and `align-items: center` (cross axis).", ["justify-content centers along main axis.", "align-items centers along cross axis."], "CSS Flexbox check", "true", "Figma", "Canva", "Adobe"),
        ("Dark Mode Theme Switcher Context", "Implement a theme state reducer handling theme switching (`light`, `dark`, `system`).", "function themeReducer(state, action) {\n  switch (action.type) {\n    case 'TOGGLE': return state === 'dark' ? 'light' : 'dark';\n    case 'SET': return action.payload;\n    default: return state;\n  }\n}\nconsole.log(themeReducer('light', { type: 'TOGGLE' }), themeReducer('light', { type: 'SET', payload: 'system' }));", "### Solution\nUse a state reducer to manage theme transitions and store active theme in localStorage/DOM class list.", ["Toggle between light and dark.", "Apply 'dark' class to html element."], "themeReducer toggle & set", "dark system", "GitHub", "Notion", "Linear"),
        ("Memoize Function Polyfill", "Implement a generic `memoize(fn)` decorator utility that caches function returns based on stringified arguments.", "function memoize(fn) {\n  const cache = new Map();\n  return function (...args) {\n    const key = JSON.stringify(args);\n    if (cache.has(key)) return cache.get(key);\n    const result = fn.apply(this, args);\n    cache.set(key, result);\n    return result;\n  };\n}\nlet calls = 0;\nconst add = memoize((a, b) => { calls++; return a + b; });\nadd(2, 3); add(2, 3);\nconsole.log(add(2, 3), 'Calls:', calls);", "### Solution\nUse a Map key-value store to cache execution results per serialized argument tuple.", ["Serialize arguments into cache key.", "Return cached result if present."], "memoize add(2,3) called twice", "5 Calls: 1", "Meta", "Google", "Microsoft")
    ])
]

cs_fundamentals_questions = [
    {
        "id": f"cs-00{i+2}",
        "domain": "cs_fundamentals",
        "topic": "CS Fundamentals",
        "difficulty": "Easy" if i in [6, 8] else ("Hard" if i in [1, 2, 10, 14] else "Medium"),
        "companies": [c1, c2, c3],
        "title": title,
        "description": desc,
        "input_format": "CS Problem Statement & Specs",
        "output_format": "Algorithm output / Execution log",
        "starter_code": starter,
        "editorial": ed,
        "hints": hints,
        "test_cases": [{"input": test_in, "expected": test_out}]
    }
    for i, (title, desc, starter, ed, hints, test_in, test_out, c1, c2, c3) in enumerate([
        ("Producer-Consumer Problem using Mutex & Semaphores", "Simulate the classic Producer-Consumer thread synchronization problem using a bounded buffer queue and mutex locks.", "class BoundedBuffer:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.buffer = []\n\n    def produce(self, item):\n        if len(self.buffer) < self.cap:\n            self.buffer.append(item)\n            return True\n        return False  # Buffer full\n\n    def consume(self):\n        if len(self.buffer) > 0:\n            return self.buffer.pop(0)\n        return None  # Buffer empty\n\nbuf = BoundedBuffer(2)\nbuf.produce(10); buf.produce(20)\nprint('Produced 2 items, third:', buf.produce(30))\nprint('Consumed:', buf.consume())", "### Solution\nUse semaphores `empty`, `full`, and a mutex to guard buffer access.", ["Producer waits if empty semaphore = 0.", "Consumer waits if full semaphore = 0."], "BoundedBuffer capacity=2 produce 3 items", "Produced 2 items, third: False\nConsumed: 10", "Microsoft", "Qualcomm", "Intel"),
        ("Deadlock Detection - Banker's Algorithm", "Implement Banker's Algorithm to check whether allocating resources to processes leaves the OS in a safe execution state.", "def is_safe_state(available, max_claim, allocation):\n    n = len(allocation)\n    m = len(available)\n    need = [[max_claim[i][j] - allocation[i][j] for jj in range(m)] for i in range(n)]\n    work = list(available)\n    finish = [False] * n\n    safe_seq = []\n    for _ in range(n):\n        found = False\n        for i in range(n):\n            if not finish[i] and all(need[i][j] <= work[j] for j in range(m)):\n                for j in range(m): work[j] += allocation[i][j]\n                finish[i] = True\n                safe_seq.append(i)\n                found = True\n                break\n        if not found: return False, []\n    return True, safe_seq\n\nsafe, seq = is_safe_state([3,3,2], [[7,5,3],[3,2,2]], [[0,1,0],[2,0,0]])\nprint('Safe:', safe)", "### Solution\nCompute Need matrix = Max - Allocation. Iteratively find processes where Need <= Work.", ["Need matrix = Max - Allocation.", "Add allocated resources back to Work vector once process finishes."], "Banker's Algorithm safe state check", "Safe: True", "Amazon", "Cisco", "Oracle"),
        ("CPU Scheduling - Round Robin Simulation", "Simulate Round Robin CPU scheduling for a set of processes given Quantum time Q, computing average Waiting Time.", "def round_robin(processes, quantum):\n    # processes = [(pid, burst_time)]\n    rem_time = {p[0]: p[1] for p in processes}\n    wt = {p[0]: 0 for p in processes}\n    t = 0\n    while True:\n        done = True\n        for pid, burst in processes:\n            if rem_time[pid] > 0:\n                done = False\n                if rem_time[pid] > quantum:\n                    t += quantum\n                    rem_time[pid] -= quantum\n                else:\n                    t += rem_time[pid]\n                    wt[pid] = t - burst\n                    rem_time[pid] = 0\n        if done: break\n    return sum(wt.values()) / len(processes)\n\nprint('Avg Waiting Time:', round_robin([('P1', 10), ('P2', 5), ('P3', 8)], 2))", "### Solution\nCycle through process ready queue giving each process max `quantum` time until burst execution reaches zero.", ["Preempt running process when quantum expires.", "Calculate waiting time = turnaround_time - burst_time."], "Round Robin processes P1=10, P2=5, P3=8 Q=2", "Avg Waiting Time: 13.0", "IBM", "Intel", "Samsung"),
        ("Page Replacement - LRU vs FIFO Page Faults", "Calculate the total number of Page Faults for a given page reference string using LRU Page Replacement algorithm.", "def lru_page_faults(pages, capacity):\n    memory = []\n    faults = 0\n    for p in pages:\n        if p not in memory:\n            if len(memory) == capacity:\n                memory.pop(0)  # Evict least recently used\n            faults += 1\n            memory.append(p)\n        else:\n            memory.remove(p)\n            memory.append(p)  # Move to most recent\n    return faults\n\nprint('Page Faults:', lru_page_faults([7, 0, 1, 2, 0, 3, 0, 4, 2, 3], 3))", "### Solution\nMaintain physical memory frames list. On hit, update page position to most recent. On miss, evict frame at index 0.", ["Maintain page access order.", "Evict index 0 when memory is full."], "LRU page reference string with capacity 3", "Page Faults: 7", "Google", "Microsoft", "VMware"),
        ("Memory Management - First Fit Allocator", "Implement First Fit memory allocation algorithm to assign processes to free memory blocks.", "def first_fit(blocks, processes):\n    alloc = [-1] * len(processes)\n    b_copy = list(blocks)\n    for i, p in enumerate(processes):\n        for j, b in enumerate(b_copy):\n            if b >= p:\n                alloc[i] = j\n                b_copy[j] -= p\n                break\n    return alloc\n\nprint(first_fit([100, 500, 200, 300, 600], [212, 417, 112, 426]))", "### Solution\nIterate through memory blocks from left to right and allocate first block with capacity >= process size.", ["Allocate first block where block_size >= process_size.", "Update remaining block memory."], "First Fit allocation test", "1, 4, 1, 4", "Apple", "Nvidia", "AMD"),
        ("TCP 3-Way Handshake Simulator", "Simulate the TCP 3-way handshake state machine (LISTEN, SYN_SENT, SYN_RCVD, ESTABLISHED).", "class TCPConnection:\n    def __init__(self):\n        self.state = 'CLOSED'\n    def listen(self): self.state = 'LISTEN'\n    def send_syn(self): self.state = 'SYN_SENT'\n    def receive_syn_send_synack(self):\n        if self.state == 'LISTEN': self.state = 'SYN_RCVD'\n    def receive_synack_send_ack(self):\n        if self.state == 'SYN_SENT': self.state = 'ESTABLISHED'\n\nconn = TCPConnection()\nconn.send_syn(); conn.receive_synack_send_ack()\nprint('State:', conn.state)", "### Solution\nSimulate SYN, SYN-ACK, and ACK packets updating client/server connection states to ESTABLISHED.", ["Client: SYN_SENT -> ESTABLISHED on SYN-ACK.", "Server: LISTEN -> SYN_RCVD -> ESTABLISHED on ACK."], "TCP 3-way handshake sequence", "State: ESTABLISHED", "Cisco", "Juniper", "Cloudflare"),
        ("Bitwise Operations - Single Number III", "Given an array of numbers where exactly two elements appear once and all other elements appear twice, find the two single numbers.", "def singleNumber(nums):\n    xor = 0\n    for n in nums: xor ^= n\n    diff = xor & (-xor)  # Rightmost set bit\n    a, b = 0, 0\n    for n in nums:\n        if n & diff: a ^= n\n        else: b ^= n\n    return sorted([a, b])\n\nprint(singleNumber([1,2,1,3,2,5]))", "### Solution\nXOR all elements to get `a ^ b`. Partition numbers based on rightmost set bit `xor & (-xor)` and XOR each group.", ["`xor & (-xor)` extracts rightmost set bit.", "Partition elements into two groups based on that bit."], "singleNumber([1,2,1,3,2,5])", "[3, 5]", "Google", "Amazon", "Meta"),
        ("Garbage Collection - Mark and Sweep Simulator", "Simulate Mark-and-Sweep Garbage Collector identifying reachable heap objects from root pointers.", "def mark_and_sweep(roots, heap_objects, references):\n    visited = set()\n    def dfs(node):\n        if node in visited: return\n        visited.add(node)\n        for child in references.get(node, []):\n            dfs(child)\n    for root in roots: dfs(root)\n    garbage = [obj for obj in heap_objects if obj not in visited]\n    return garbage\n\nprint('Garbage collected:', mark_and_sweep(['R1'], ['O1', 'O2', 'O3', 'O4'], {'R1': ['O1'], 'O1': ['O2']}))", "### Solution\nTrace reachable graph nodes starting from roots (Mark phase). Any unvisited heap object is garbage (Sweep phase).", ["Graph DFS/BFS traversal from root pointers.", "Collect unvisited nodes."], "Mark and sweep GC test", "Garbage collected: ['O3', 'O4']", "Oracle", "Microsoft", "JetBrains"),
        ("DNS Resolution Lookup Process", "Simulate recursive DNS resolution hierarchy (Browser Cache -> OS Resolver -> Root Server -> TLD Server -> Authoritative DNS).", "def dns_lookup(domain, cache):\n    if domain in cache: return f'Cache Hit: {cache[domain]}'\n    hierarchy = ['OS Resolver', 'Root Server (.org)', 'TLD Server (wikipedia.org)', 'Authoritative DNS']\n    return ' -> '.join(hierarchy) + ' -> 185.15.58.224'\n\nprint(dns_lookup('wikipedia.org', {}))", "### Solution\nCheck local cache first. If missed, recurse through Root Server, TLD Server, and Authoritative Name Server.", ["Browser/OS cache check occurs first.", "Authoritative DNS returns final IP mapping."], "dns_lookup('wikipedia.org')", "OS Resolver -> Root Server (.org) -> TLD Server (wikipedia.org) -> Authoritative DNS -> 185.15.58.224", "Cloudflare", "Akamai", "Verisign"),
        ("Process Context Switch Overhead Simulator", "Calculate total CPU overhead time spent in OS context switches for N processes.", "def context_switch_overhead(num_processes, switch_cost_ms, runtime_ms, quantum_ms):\n    total_switches = (runtime_ms // quantum_ms) * num_processes\n    overhead = total_switches * switch_cost_ms\n    return overhead\n\nprint('Total Context Switch Overhead:', context_switch_overhead(4, 0.005, 1000, 10), 'ms')", "### Solution\nCompute total preemption cycles = `(total_runtime / quantum) * num_processes` and multiply by PCB save/restore cost.", ["Context switch saves PCB state registers.", "Frequent context switching increases CPU overhead."], "context switch overhead 4 processes, 10ms quantum", "Total Context Switch Overhead: 2.0 ms", "RedHat", "Linux", "AWS"),
        ("LFU (Least Frequently Used) Cache Implementation", "Simulate LFU Cache eviction policy track key frequencies.", "class LFUCache:\n    def __init__(self, cap):\n        self.cap = cap\n        self.vals = {}\n        self.counts = {}\n    def get(self, key):\n        if key not in self.vals: return -1\n        self.counts[key] += 1\n        return self.vals[key]\n    def put(self, key, val):\n        if self.cap == 0: return\n        if key in self.vals:\n            self.vals[key] = val\n            self.counts[key] += 1\n        else:\n            if len(self.vals) >= self.cap:\n                lfu_key = min(self.counts, key=lambda k: self.counts[k])\n                del self.vals[lfu_key]; del self.counts[lfu_key]\n            self.vals[key] = val; self.counts[key] = 1\n\nlfu = LFUCache(2)\nlfu.put(1,1); lfu.put(2,2); lfu.get(1); lfu.put(3,3)\nprint('Get 2 evicted:', lfu.get(2))", "### Solution\nMaintain key frequency counts. Evict key with minimum access count when capacity reached.", ["Track execution frequency per key.", "Break frequency ties with LRU order if needed."], "LFU Cache get(2) evicted check", "Get 2 evicted: -1", "Amazon", "Meta", "Redis"),
        ("Dining Philosophers Problem Solution", "Simulate resource hierarchy solution to avoid deadlock in Dining Philosophers problem.", "def dining_philosophers(num_philosophers):\n    # Pick lower index fork first to break circular wait\n    actions = []\n    for i in range(num_philosophers):\n        f1, f2 = min(i, (i+1)%num_philosophers), max(i, (i+1)%num_philosophers)\n        actions.append(f'Philosopher {i}: Pick Fork {f1} then Fork {f2}')\n    return actions\n\nprint('\\n'.join(dining_philosophers(3)))", "### Solution\nBreak circular wait condition by requiring all philosophers to pick up the lower-numbered chopstick/fork first.", ["Break circular wait condition.", "Resource ordering prevents deadlock."], "Dining philosophers 3 seats", "Philosopher 0: Pick Fork 0 then Fork 1\nPhilosopher 1: Pick Fork 1 then Fork 2\nPhilosopher 2: Pick Fork 0 then Fork 2", "Microsoft", "Intel", "Oracle"),
        ("RAID Storage Parity Calculation", "Calculate RAID 5 parity byte for 3 data blocks using Bitwise XOR.", "def calculate_raid5_parity(block1, block2, block3):\n    return block1 ^ block2 ^ block3\n\nprint('Parity Byte:', hex(calculate_raid5_parity(0xAF, 0x3C, 0x91)))", "### Solution\nRAID 5 uses bitwise XOR across data blocks (`P = D1 ^ D2 ^ D3`) to reconstruct lost drive data.", ["XOR parity enables single-drive failure recovery.", "Parity is distributed across all array drives."], "RAID 5 parity calculation for 0xAF, 0x3C, 0x91", "Parity Byte: 0x0", "NetApp", "Dell EMC", "Seagate"),
        ("Inode Filesystem Allocation Lookup", "Calculate maximum file size supported by an Ext2 style Inode structure.", "def max_file_size(block_size=4096):\n    direct = 12 * block_size\n    single_indirect = (block_size // 4) * block_size\n    double_indirect = ((block_size // 4) ** 2) * block_size\n    triple_indirect = ((block_size // 4) ** 3) * block_size\n    total_gb = (direct + single_indirect + double_indirect + triple_indirect) / (1024 ** 3)\n    return round(total_gb, 2)\n\nprint('Max File Size:', max_file_size(), 'GB')", "### Solution\nSum direct pointers (12) + single indirect + double indirect + triple indirect block addressing capacities.", ["Block pointers store 32-bit block addresses.", "4KB block holds 1024 block pointers."], "Ext2 max file size calculation", "Max File Size: 4096.0 GB", "RedHat", "Canonical", "SUSE"),
        ("Asynchronous I/O Multiplexing (epoll)", "Demonstrate edge-triggered vs level-triggered event notification model in Linux epoll.", "def simulate_epoll(events):\n    ready_fds = []\n    for fd, status in events:\n        if 'READABLE' in status:\n            ready_fds.append(fd)\n    return ready_fds\n\nprint('Ready FDs:', simulate_epoll([(3, 'READABLE'), (4, 'WRITABLE'), (5, 'READABLE')]))", "### Solution\nI/O multiplexing (`select`, `poll`, `epoll`) allows a single thread to monitor thousands of file descriptors without blocking.", ["`epoll` offers O(1) performance vs O(N) in `select`.", "Edge-triggered notifies once on status transition."], "epoll simulation", "Ready FDs: [3, 5]", "NGINX", "Cloudflare", "HAProxy")
    ])
]

def main():
    with open('backend/data/dsa_questions.json', 'r', encoding='utf-8') as f:
        existing = json.load(f)

    print(f"Original questions count: {len(existing)}")

    # Add all new questions
    new_questions = sql_questions + system_design_questions + web_dev_questions + cs_fundamentals_questions
    print(f"Adding {len(new_questions)} new questions across non-DSA domains...")

    all_questions = existing + new_questions

    with open('backend/data/dsa_questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, indent=2, ensure_ascii=False)

    print(f"Updated questions count: {len(all_questions)}")

if __name__ == "__main__":
    main()

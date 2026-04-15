'use strict';
// Stanford CS Curriculum v2 — one Course per subject, grouped by Year
// Run: flyctl ssh console --app nibras-api --command "node /app/seed-stanford-v2.js"

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INSTRUCTOR_ID = 'cmnmguy3l0000u5hpqtm9ebci'; // EpitomeZied

// Old year-level courses to remove
const OLD_COURSE_SLUGS = ['stanford-cs-y1', 'stanford-cs-y2', 'stanford-cs-y3', 'stanford-cs-y4'];

// ── Curriculum (one Course per subject) ──────────────────────────────────────
const CURRICULUM = [
  // ─ YEAR 1: FRESHMAN ─────────────────────────────────────────────────────
  {
    year: 1,
    yearLabel: 'Year 1 · Freshman',
    courses: [
      {
        course: {
          slug: 'stanford-cs106a',
          courseCode: 'CS 106A',
          title: 'Programming Methodology',
          termLabel: 'Year 1 · Freshman',
        },
        project: {
          subject: { slug: 'cs106a', name: 'CS 106A' },
          slug: 'cs106a-main',
          name: 'CS 106A — Programming Methodology',
          description:
            'Introduction to programming using Python. Covers variables, control flow, functions, and object-oriented programming. The entry point to the Stanford CS curriculum.',
          level: 1,
          rubric: [
            { criterion: 'Correctness', maxScore: 50 },
            { criterion: 'Code Quality & Decomposition', maxScore: 30 },
            { criterion: 'Write-up & Explanation', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Variables, Expressions & Control Flow',
              description:
                'Write Python programs using variables, arithmetic expressions, and control flow (if/while/for). Complete Karel exercises 1–5.',
              order: 0,
            },
            {
              title: 'Functions & Decomposition',
              description:
                'Implement recursive and iterative functions. Apply top-down decomposition to solve multi-step problems.',
              order: 1,
            },
            {
              title: 'Object-Oriented Programming',
              description:
                'Define classes, constructors, and methods. Implement inheritance and polymorphism in a simple class hierarchy.',
              order: 2,
            },
            {
              title: 'Final: Karel the Robot',
              description:
                'Build a fully-functional Karel world using all OOP principles learned. Submit your GitHub repo and a short write-up explaining your design.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs106b',
          courseCode: 'CS 106B',
          title: 'Programming Abstractions',
          termLabel: 'Year 1 · Freshman',
        },
        project: {
          subject: { slug: 'cs106b', name: 'CS 106B' },
          slug: 'cs106b-main',
          name: 'CS 106B — Programming Abstractions',
          description:
            'C++ programming with a focus on abstraction, recursion, and fundamental data structures: stacks, queues, sets, maps, trees, and graphs.',
          level: 1,
          rubric: [
            { criterion: 'Correctness & Edge Cases', maxScore: 50 },
            { criterion: 'Algorithm Efficiency', maxScore: 30 },
            { criterion: 'Code Clarity', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Recursion Fundamentals',
              description:
                'Solve classic recursive problems: permutations, Towers of Hanoi, fractal drawing. Implement backtracking search.',
              order: 0,
            },
            {
              title: 'Abstract Data Types (Stack, Queue, Map, Set)',
              description:
                'Implement and use Stack, Queue, Set, and Map. Analyse time complexity of each operation. Solve a real problem using each ADT.',
              order: 1,
            },
            {
              title: 'Trees & Priority Queues',
              description:
                'Implement a binary search tree with insert, search, and delete. Build a min-heap and use it for Huffman encoding.',
              order: 2,
            },
            {
              title: 'Final: Huffman Encoder/Decoder',
              description:
                'Build a complete file compression tool using Huffman coding. Benchmark compression ratio vs. gzip on a test corpus.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs103',
          courseCode: 'CS 103',
          title: 'Mathematical Foundations of Computing',
          termLabel: 'Year 1 · Freshman',
        },
        project: {
          subject: { slug: 'cs103', name: 'CS 103' },
          slug: 'cs103-main',
          name: 'CS 103 — Mathematical Foundations of Computing',
          description:
            'Logic, proofs, sets, functions, relations, finite automata, regular languages, and an introduction to computability and complexity.',
          level: 1,
          rubric: [
            { criterion: 'Proof Correctness & Rigour', maxScore: 60 },
            { criterion: 'Formal Notation', maxScore: 20 },
            { criterion: 'Clarity of Argument', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Propositional Logic & Proof Techniques',
              description:
                'Write formal proofs using direct proof, contradiction, and induction. Solve 10 logic puzzles and submit proofs.',
              order: 0,
            },
            {
              title: 'Sets, Functions & Relations',
              description:
                'Prove properties of sets and functions (injective, surjective, bijective). Solve problems on equivalence relations and partial orders.',
              order: 1,
            },
            {
              title: 'Finite Automata & Regular Languages',
              description:
                'Construct DFAs and NFAs. Convert NFA→DFA. Prove languages non-regular using the Pumping Lemma.',
              order: 2,
            },
            {
              title: 'Final: Computability & Complexity',
              description:
                'Prove a language is undecidable via reduction from the Halting Problem. Solve 3 NP-completeness reductions. Write a 4-page proof report.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs107',
          courseCode: 'CS 107',
          title: 'Computer Organization & Systems',
          termLabel: 'Year 1 · Freshman',
        },
        project: {
          subject: { slug: 'cs107', name: 'CS 107' },
          slug: 'cs107-main',
          name: 'CS 107 — Computer Organization & Systems',
          description:
            'C programming, data representation, memory layout, x86-64 assembly, caching, and the toolchain (gcc, gdb, valgrind, make).',
          level: 1,
          rubric: [
            { criterion: 'Memory Safety (Valgrind-clean)', maxScore: 40 },
            { criterion: 'Correctness', maxScore: 40 },
            { criterion: 'Performance', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'C Programming & Pointers',
              description:
                'Write C programs using pointers, arrays, and structs. Debug memory errors with valgrind. Implement a linked list and hash table in C.',
              order: 0,
            },
            {
              title: 'Bits, Bytes & Memory',
              description:
                "Implement integer encoding (two's complement), floating-point bit manipulation, and a bitset. Analyse memory alignment and padding.",
              order: 1,
            },
            {
              title: 'x86-64 Assembly',
              description:
                'Read and hand-trace x86-64 assembly from compiled C. Implement 3 functions in inline assembly. Optimise a hot loop using SIMD intrinsics.',
              order: 2,
            },
            {
              title: 'Final: Custom Memory Allocator',
              description:
                'Implement malloc, realloc, and free using an explicit free-list with coalescing. Achieve ≥ 60% memory utilisation on the trace files provided.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
    ],
  },

  // ─ YEAR 2: SOPHOMORE ────────────────────────────────────────────────────
  {
    year: 2,
    yearLabel: 'Year 2 · Sophomore',
    courses: [
      {
        course: {
          slug: 'stanford-cs109',
          courseCode: 'CS 109',
          title: 'Probability for Computer Scientists',
          termLabel: 'Year 2 · Sophomore',
        },
        project: {
          subject: { slug: 'cs109', name: 'CS 109' },
          slug: 'cs109-main',
          name: 'CS 109 — Probability for Computer Scientists',
          description:
            'Probability, counting, random variables, distributions (Binomial, Poisson, Gaussian), Bayesian inference, MLE, and Markov chains.',
          level: 2,
          rubric: [
            { criterion: 'Mathematical Derivations', maxScore: 50 },
            { criterion: 'Implementation Correctness', maxScore: 30 },
            { criterion: 'Analysis & Interpretation', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Counting & Probability Axioms',
              description:
                'Solve 20 counting problems (permutations, combinations, inclusion-exclusion). Prove basic probability theorems. Implement a Monte Carlo estimator of π.',
              order: 0,
            },
            {
              title: 'Random Variables & Distributions',
              description:
                'Derive PMFs/PDFs for Binomial, Geometric, Poisson, and Gaussian distributions. Implement a central-limit-theorem simulator.',
              order: 1,
            },
            {
              title: 'Bayesian Networks & MLE',
              description:
                'Build a Naïve Bayes spam classifier. Derive and implement MLE for Gaussian and Bernoulli distributions. Evaluate on a held-out email dataset.',
              order: 2,
            },
            {
              title: 'Final: Probabilistic Inference Engine',
              description:
                'Implement variable-elimination for exact inference in a Bayesian network. Test on a medical-diagnosis network with 10+ nodes.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs110',
          courseCode: 'CS 110',
          title: 'Principles of Computer Systems',
          termLabel: 'Year 2 · Sophomore',
        },
        project: {
          subject: { slug: 'cs110', name: 'CS 110' },
          slug: 'cs110-main',
          name: 'CS 110 — Principles of Computer Systems',
          description:
            'Filesystems, processes, signals, IPC, multithreading, synchronisation, and introductory network programming in C/C++.',
          level: 2,
          rubric: [
            { criterion: 'Correctness under Concurrency', maxScore: 45 },
            { criterion: 'Resource Management (no leaks/deadlocks)', maxScore: 35 },
            { criterion: 'Performance Benchmarks', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Filesystems & I/O',
              description:
                'Implement a shell built-in that mirrors GNU ls using low-level POSIX calls (opendir, stat, read). Handle symlinks and hidden files.',
              order: 0,
            },
            {
              title: 'Processes & Signals',
              description:
                'Build a job-control shell (foreground/background, SIGCHLD, SIGINT, SIGTSTP). Implement a pipe operator using fork/exec/pipe.',
              order: 1,
            },
            {
              title: 'Multithreading & Synchronisation',
              description:
                'Implement a thread pool using pthreads, condition variables, and mutexes. Demonstrate absence of data races using ThreadSanitizer.',
              order: 2,
            },
            {
              title: 'Final: Multithreaded HTTP/1.1 Server',
              description:
                'Build a fully concurrent HTTP/1.1 server with keep-alive, GET/HEAD, and directory listing. Sustain 500 req/s under ApacheBench.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs143',
          courseCode: 'CS 143',
          title: 'Compilers',
          termLabel: 'Year 2 · Sophomore',
        },
        project: {
          subject: { slug: 'cs143', name: 'CS 143' },
          slug: 'cs143-main',
          name: 'CS 143 — Compilers',
          description:
            'Complete compiler construction for COOL: lexing, parsing (LALR), semantic analysis, type checking, and code generation to MIPS assembly.',
          level: 2,
          rubric: [
            { criterion: 'Test Suite Pass Rate', maxScore: 60 },
            { criterion: 'Error Recovery & Messages', maxScore: 25 },
            { criterion: 'Code Quality', maxScore: 15 },
          ],
          milestones: [
            {
              title: 'Lexical Analysis (flex)',
              description:
                'Implement the COOL lexer using flex. Handle all string escape sequences and nested comments. Pass ≥ 95% of the lexer test suite.',
              order: 0,
            },
            {
              title: 'Syntax Analysis (bison LALR)',
              description:
                'Write the COOL LALR(1) grammar in bison. Resolve all shift/reduce conflicts. Pass the parser test suite and produce correct ASTs.',
              order: 1,
            },
            {
              title: 'Semantic Analysis & Type Checking',
              description:
                'Build the symbol table, perform scope analysis, and implement the COOL type system. Report meaningful error messages for all 15 type errors.',
              order: 2,
            },
            {
              title: 'Final: Full COOL Compiler → MIPS',
              description:
                'Implement code generation to MIPS assembly with correct object layout, dispatch tables, GC roots, and runtime calls. Pass all 63 reference tests.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs161',
          courseCode: 'CS 161',
          title: 'Design & Analysis of Algorithms',
          termLabel: 'Year 2 · Sophomore',
        },
        project: {
          subject: { slug: 'cs161-algo', name: 'CS 161 Algorithms' },
          slug: 'cs161-main',
          name: 'CS 161 — Design & Analysis of Algorithms',
          description:
            'Asymptotic analysis, divide-and-conquer, dynamic programming, greedy algorithms, graph algorithms, and NP-completeness.',
          level: 2,
          rubric: [
            { criterion: 'Correctness Proofs', maxScore: 40 },
            { criterion: 'Algorithm Implementation', maxScore: 40 },
            { criterion: 'Complexity Analysis', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Divide & Conquer',
              description:
                'Implement and analyse MergeSort, QuickSort, and Strassen matrix multiplication. Solve 5 recurrence relations using the Master Theorem.',
              order: 0,
            },
            {
              title: 'Dynamic Programming',
              description:
                'Solve Edit Distance, LCS, Matrix Chain, and 0/1 Knapsack. Reconstruct solutions with traceback. Analyse space optimisations.',
              order: 1,
            },
            {
              title: 'Graph Algorithms',
              description:
                'Implement BFS, DFS, Dijkstra, Bellman-Ford, Kruskal, and Prim. Solve 3 graph problems. Benchmark on 10M-edge graphs.',
              order: 2,
            },
            {
              title: 'Final: NP-Completeness & Approximation',
              description:
                'Prove 3-SAT ≤_p Independent Set. Implement a 2-approximation for Vertex Cover. Design a local-search TSP heuristic.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
    ],
  },

  // ─ YEAR 3: JUNIOR ───────────────────────────────────────────────────────
  {
    year: 3,
    yearLabel: 'Year 3 · Junior',
    courses: [
      {
        course: {
          slug: 'stanford-cs221',
          courseCode: 'CS 221',
          title: 'Artificial Intelligence: Principles & Techniques',
          termLabel: 'Year 3 · Junior',
        },
        project: {
          subject: { slug: 'cs221', name: 'CS 221' },
          slug: 'cs221-main',
          name: 'CS 221 — Artificial Intelligence',
          description:
            'Search, CSP, MDPs, game trees, Bayesian networks, HMMs, machine learning basics, and logic-based AI. Stanford flagship AI course.',
          level: 3,
          rubric: [
            { criterion: 'Agent Performance Score', maxScore: 50 },
            { criterion: 'Algorithm Correctness', maxScore: 30 },
            { criterion: 'Analysis Write-up', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Search & Constraint Satisfaction',
              description:
                'Implement A* for Pac-Man with a custom admissible heuristic. Solve a scheduling CSP using arc-consistency + backtracking.',
              order: 0,
            },
            {
              title: 'MDPs & Reinforcement Learning',
              description:
                'Implement Value Iteration and Policy Iteration for a grid-world MDP. Train Q-learning on Blackjack and report win rate vs. dealer.',
              order: 1,
            },
            {
              title: 'Game Trees & Adversarial Search',
              description:
                'Implement Minimax with alpha-beta pruning for a 2-player game. Add iterative deepening and an evaluation function. Achieve > 70% win rate vs. random.',
              order: 2,
            },
            {
              title: 'Final: Pac-Man AI Agent',
              description:
                'Build a complete Pac-Man agent combining A* navigation, ghost-avoidance MDP, and a learned score estimator. Score ≥ 900 on the competition map.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs229',
          courseCode: 'CS 229',
          title: 'Machine Learning',
          termLabel: 'Year 3 · Junior',
        },
        project: {
          subject: { slug: 'cs229', name: 'CS 229' },
          slug: 'cs229-main',
          name: 'CS 229 — Machine Learning',
          description:
            'Supervised learning (regression, SVMs, trees), unsupervised learning (k-means, PCA, EM), neural networks, regularisation, bias-variance, and ML theory.',
          level: 3,
          rubric: [
            { criterion: 'Model Performance (Metrics)', maxScore: 45 },
            { criterion: 'Correctness of Implementation', maxScore: 35 },
            { criterion: 'Report Quality', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Supervised Learning',
              description:
                'Implement linear regression, logistic regression, and a decision tree from scratch. Tune hyperparameters via cross-validation on a real dataset.',
              order: 0,
            },
            {
              title: 'Neural Networks & Backpropagation',
              description:
                'Build a 3-layer MLP in NumPy with forward/backward pass, Adam optimiser, and batch normalisation. Achieve ≥ 97% accuracy on MNIST.',
              order: 1,
            },
            {
              title: 'Unsupervised Learning & EM',
              description:
                'Implement k-means and GMM with EM. Run PCA on a face dataset and reconstruct faces from 50 principal components.',
              order: 2,
            },
            {
              title: 'Final: End-to-End ML Research Project',
              description:
                'Select a real-world dataset. Build a complete ML pipeline (EDA → feature engineering → model selection → ensemble → error analysis). Write a 6-page report.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs246',
          courseCode: 'CS 246',
          title: 'Mining Massive Datasets',
          termLabel: 'Year 3 · Junior',
        },
        project: {
          subject: { slug: 'cs246', name: 'CS 246' },
          slug: 'cs246-main',
          name: 'CS 246 — Mining Massive Datasets',
          description:
            'MapReduce, Spark, locality-sensitive hashing, recommendation systems, PageRank, community detection, and stream mining at billion-scale.',
          level: 3,
          rubric: [
            { criterion: 'Scale & Performance', maxScore: 40 },
            { criterion: 'Algorithm Correctness', maxScore: 40 },
            { criterion: 'Visualisation & Insights', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'MapReduce, Hadoop & Spark',
              description:
                'Implement word count, inverted index, and matrix multiplication using Spark RDDs. Profile job DAGs and optimise a slow stage by 5×.',
              order: 0,
            },
            {
              title: 'Similarity Search & LSH',
              description:
                'Implement MinHash and LSH to find near-duplicate documents in a 1M-document corpus. Evaluate precision/recall and tune band/row parameters.',
              order: 1,
            },
            {
              title: 'Recommendation Systems',
              description:
                'Implement item-item collaborative filtering and matrix factorisation (SGD) on MovieLens 20M. Report RMSE vs. baseline.',
              order: 2,
            },
            {
              title: 'Final: Social Network Analysis',
              description:
                'Compute PageRank, betweenness centrality, and Louvain community detection on a 10M-edge Twitter graph using GraphX. Visualise top-100 communities.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs255',
          courseCode: 'CS 255',
          title: 'Introduction to Cryptography',
          termLabel: 'Year 3 · Junior',
        },
        project: {
          subject: { slug: 'cs255', name: 'CS 255' },
          slug: 'cs255-main',
          name: 'CS 255 — Introduction to Cryptography',
          description:
            'Provable security, symmetric encryption (AES), MACs, hash functions, public-key crypto (RSA, ECDH), digital signatures, and TLS.',
          level: 3,
          rubric: [
            { criterion: 'Security Proof / Analysis', maxScore: 45 },
            { criterion: 'Implementation Correctness', maxScore: 40 },
            { criterion: 'Write-up Clarity', maxScore: 15 },
          ],
          milestones: [
            {
              title: 'Symmetric Encryption & MACs',
              description:
                'Implement CBC-AES and CTR-AES modes. Build AES-GCM authenticated encryption. Break a padding-oracle CBC attack.',
              order: 0,
            },
            {
              title: 'Hash Functions & Public-Key Crypto',
              description:
                'Implement RSA encrypt/decrypt/sign from scratch. Demonstrate OAEP padding. Implement ECDH key exchange on Curve25519.',
              order: 1,
            },
            {
              title: 'Digital Signatures & Protocols',
              description:
                'Implement ECDSA signing and verification. Design and formally analyse a 3-message authentication protocol.',
              order: 2,
            },
            {
              title: 'Final: Secure Communication System',
              description:
                'Build an end-to-end encrypted messaging app using X3DH (Signal Protocol) for key exchange and AES-GCM for messages. Achieve forward secrecy.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
    ],
  },

  // ─ YEAR 4: SENIOR ───────────────────────────────────────────────────────
  {
    year: 4,
    yearLabel: 'Year 4 · Senior',
    courses: [
      {
        course: {
          slug: 'stanford-cs230',
          courseCode: 'CS 230',
          title: 'Deep Learning',
          termLabel: 'Year 4 · Senior',
        },
        project: {
          subject: { slug: 'cs230', name: 'CS 230' },
          slug: 'cs230-main',
          name: 'CS 230 — Deep Learning',
          description:
            'CNNs, RNNs/LSTMs, transformers, transfer learning, GANs, VAEs, batch normalisation, dropout, and practical PyTorch engineering.',
          level: 4,
          rubric: [
            { criterion: 'Model Accuracy (Benchmark)', maxScore: 40 },
            { criterion: 'Architecture Soundness', maxScore: 35 },
            { criterion: 'Paper / Write-up Quality', maxScore: 25 },
          ],
          milestones: [
            {
              title: 'CNNs & Image Recognition',
              description:
                'Implement ResNet-18 from scratch in PyTorch. Train on CIFAR-10 with data augmentation. Visualise grad-CAM activations. Achieve ≥ 92% test accuracy.',
              order: 0,
            },
            {
              title: 'RNNs, LSTMs & Sequence Modelling',
              description:
                'Implement a character-level LSTM language model trained on Shakespeare. Implement seq2seq with attention for date-format translation.',
              order: 1,
            },
            {
              title: 'Transformers & Generative Models',
              description:
                'Fine-tune BERT on a text classification task (≥ 90% F1). Implement a mini-GPT (12-layer). Train a DCGAN on CelebA, evaluate FID ≤ 30.',
              order: 2,
            },
            {
              title: 'Final: Deep Learning Application',
              description:
                'Build and deploy a production-ready DL application (medical imaging, audio, or code generation). Write a 6-page NeurIPS-style paper.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs224n',
          courseCode: 'CS 224N',
          title: 'NLP with Deep Learning',
          termLabel: 'Year 4 · Senior',
        },
        project: {
          subject: { slug: 'cs224n', name: 'CS 224N' },
          slug: 'cs224n-main',
          name: 'CS 224N — NLP with Deep Learning',
          description:
            'Word vectors (Word2Vec, GloVe), dependency parsing, machine translation (seq2seq + attention), BERT, GPT, and state-of-the-art NLP systems.',
          level: 4,
          rubric: [
            { criterion: 'NLP Metric (BLEU/F1/EM)', maxScore: 45 },
            { criterion: 'Model Design', maxScore: 35 },
            { criterion: 'Error Analysis', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Word Vectors & Language Models',
              description:
                'Implement Skip-gram Word2Vec with negative sampling. Analyse word analogies. Train a trigram LM and compute perplexity.',
              order: 0,
            },
            {
              title: 'Neural Dependency Parsing',
              description:
                'Implement a transition-based dependency parser using a feed-forward neural network. Achieve ≥ 87% UAS on Penn Treebank WSJ.',
              order: 1,
            },
            {
              title: 'Machine Translation with Transformers',
              description:
                'Implement the full Transformer (encoder-decoder, multi-head attention, positional encoding) for EN→FR. Achieve ≥ 30 BLEU on WMT14.',
              order: 2,
            },
            {
              title: 'Final: Question Answering System',
              description:
                'Fine-tune a pre-trained LM on SQuAD 2.0. Implement a retriever-reader pipeline for open-domain QA. Achieve F1 ≥ 82% on the dev set.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs231n',
          courseCode: 'CS 231N',
          title: 'Deep Learning for Computer Vision',
          termLabel: 'Year 4 · Senior',
        },
        project: {
          subject: { slug: 'cs231n', name: 'CS 231N' },
          slug: 'cs231n-main',
          name: 'CS 231N — Deep Learning for Computer Vision',
          description:
            'Image classification, object detection (YOLO, Faster R-CNN), semantic segmentation (U-Net), image generation, and neural style transfer.',
          level: 4,
          rubric: [
            { criterion: 'Task Metric (mAP/Dice/Top-1)', maxScore: 50 },
            { criterion: 'Architecture Design', maxScore: 30 },
            { criterion: 'Demo & Presentation', maxScore: 20 },
          ],
          milestones: [
            {
              title: 'Image Classification & CNNs',
              description:
                'Implement full CNN forward/backward pass including convolution, pooling, and batch norm. Reproduce VGG-16. Achieve ≥ 73% top-1 on ImageNet mini.',
              order: 0,
            },
            {
              title: 'Object Detection',
              description:
                'Implement anchor-based detection on a ResNet backbone. Train on COCO mini. Achieve ≥ 35 mAP@0.5. Compare YOLOv5 vs. Faster R-CNN.',
              order: 1,
            },
            {
              title: 'Semantic Segmentation',
              description:
                'Implement U-Net for medical image segmentation on the LiTS liver dataset. Achieve Dice ≥ 0.88. Visualise uncertainty using MC Dropout.',
              order: 2,
            },
            {
              title: 'Final: Visual Recognition System',
              description:
                'Build a real-time pipeline: object detection + instance segmentation + caption generation. Demo as a live webcam application.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
      {
        course: {
          slug: 'stanford-cs-capstone',
          courseCode: 'CS Capstone',
          title: 'Senior Capstone Research Project',
          termLabel: 'Year 4 · Senior',
        },
        project: {
          subject: { slug: 'cs-capstone', name: 'CS Capstone' },
          slug: 'cs-capstone-main',
          name: 'CS Senior Capstone — Research Project',
          description:
            'Independent research under faculty supervision. Students define a novel problem, survey literature, implement a system, evaluate results, and write an academic paper.',
          level: 4,
          rubric: [
            { criterion: 'Novelty & Contribution', maxScore: 35 },
            { criterion: 'Experimental Rigour', maxScore: 35 },
            { criterion: 'Paper & Presentation Quality', maxScore: 30 },
          ],
          milestones: [
            {
              title: 'Problem Statement & Literature Review',
              description:
                'Define a clearly scoped research question. Survey ≥ 20 related papers. Write a 3-page related-work section. Present a gap analysis and proposed contribution.',
              order: 0,
            },
            {
              title: 'System Architecture & Baseline',
              description:
                'Design the system architecture (block diagram + API spec). Implement and evaluate a baseline. Write a 2-page methods section with ablation plan.',
              order: 1,
            },
            {
              title: 'Implementation & Evaluation',
              description:
                'Implement the full system and run all ablation experiments. Analyse results with significance tests. Prepare a draft results section and 3 key figures.',
              order: 2,
            },
            {
              title: 'Final: Research Paper & Presentation',
              description:
                'Submit a complete 8-page NeurIPS/ICML-format paper. Present to faculty panel (15 min + 5 min Q&A). Open-source code and data on GitHub.',
              order: 3,
              isFinal: true,
            },
          ],
        },
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertSubject(slug, name) {
  const existing = await prisma.subject.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.subject.create({ data: { slug, name } });
}

// ── Cleanup old year-courses ──────────────────────────────────────────────────
async function removeOldYearCourses() {
  console.log('\n🗑   Removing old year-level courses…\n');
  for (const slug of OLD_COURSE_SLUGS) {
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) {
      console.log(`  ↩  ${slug} — not found, skipping`);
      continue;
    }

    // Delete projects and their milestones
    const projects = await prisma.project.findMany({ where: { courseId: course.id } });
    for (const p of projects) {
      await prisma.milestone.deleteMany({ where: { projectId: p.id } });
      await prisma.project.delete({ where: { id: p.id } });
    }

    // Delete memberships and the course
    await prisma.courseMembership.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    console.log(`  ✓  Deleted: ${slug}`);
  }
  console.log('');
}

// ── Seeder ────────────────────────────────────────────────────────────────────
async function seed() {
  await removeOldYearCourses();

  console.log('🎓  Seeding Stanford CS — individual courses per subject…\n');

  for (const { year, yearLabel, courses } of CURRICULUM) {
    console.log(`── ${yearLabel} ${'─'.repeat(50 - yearLabel.length)}`);

    for (const { course: c, project: proj } of courses) {
      // Upsert course
      let course = await prisma.course.findUnique({ where: { slug: c.slug } });
      if (course) {
        console.log(`  ↩  ${c.courseCode} ${c.title} — already exists`);
      } else {
        course = await prisma.course.create({
          data: { slug: c.slug, courseCode: c.courseCode, title: c.title, termLabel: c.termLabel },
        });
        console.log(`  ✓  Course: [${c.courseCode}] ${c.title}`);
      }

      // Ensure EpitomeZied is instructor
      const mem = await prisma.courseMembership.findFirst({
        where: { courseId: course.id, userId: INSTRUCTOR_ID },
      });
      if (!mem) {
        await prisma.courseMembership.create({
          data: { courseId: course.id, userId: INSTRUCTOR_ID, role: 'instructor', level: year },
        });
      }

      // Upsert project
      const subject = await upsertSubject(proj.subject.slug, proj.subject.name);
      let project = await prisma.project.findUnique({ where: { slug: proj.slug } });
      if (project) {
        // Re-link to new course if needed
        if (project.courseId !== course.id) {
          await prisma.project.update({ where: { id: project.id }, data: { courseId: course.id } });
        }
        console.log(`     ↩  Project exists: ${proj.name}`);
      } else {
        project = await prisma.project.create({
          data: {
            subjectId: subject.id,
            courseId: course.id,
            slug: proj.slug,
            name: proj.name,
            description: proj.description,
            status: 'published',
            deliveryMode: 'individual',
            level: proj.level,
            rubricJson: proj.rubric,
            resourcesJson: [],
          },
        });
        console.log(`     ✓  Project: ${proj.name}`);
      }

      // Create milestones if missing
      const existingMs = await prisma.milestone.count({ where: { projectId: project.id } });
      if (existingMs === 0) {
        for (const ms of proj.milestones) {
          await prisma.milestone.create({
            data: {
              projectId: project.id,
              title: ms.title,
              description: ms.description,
              order: ms.order,
              isFinal: ms.isFinal ?? false,
            },
          });
        }
        console.log(`        → ${proj.milestones.length} milestones created`);
      }
    }
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log('✅  Done! Stanford CS curriculum restructured.\n');
  console.log('Summary:\n');
  for (const { yearLabel, courses: cs } of CURRICULUM) {
    console.log(`  ${yearLabel}`);
    for (const { course: c } of cs) console.log(`    • [${c.courseCode}] ${c.title}`);
    console.log('');
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

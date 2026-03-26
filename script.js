document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('guideForm');
  const output = document.getElementById('output');
  const guideContent = document.getElementById('guideContent');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    generateGuide();
  });

  function generateGuide() {
    const topic = document.getElementById('topic').value.trim();
    const level = document.getElementById('level').value;
    const format = document.getElementById('format').value;
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!topic) {
      showError('Please enter a topic to study.');
      return;
    }

    showLoading();
    hideError();

    if (apiKey) {
      // Use backend proxy for real AI (avoid browser CORS issues)
      callBackendAI(topic, level, format, apiKey);
    } else {
      // Use mock AI
      setTimeout(() => {
        const guide = createRevisionGuide(topic, level, format);
        displayGuide(guide);
      }, 2000);
    }
  }

  function callBackendAI(topic, level, format, apiKey) {
    fetch('http://localhost:3001/api/generate-guide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic, level, format, apiKey }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        displayGuide(data.guide || 'AI did not return guide text.');
      })
      .catch((err) => {
        console.error('Backend AI failed:', err);
        showError('Backend AI failed: ' + err.message + '. Trying direct Hugging Face call.');
        callHuggingFaceAPI(topic, level, format, apiKey, true);
      });
  }

  function callHuggingFaceAPI(topic, level, format, apiKey, isFallback = false) {
    const prompt = `Create a detailed revision guide for: "${topic}"
Study Level: ${level} (beginner/intermediate/advanced)
Format: ${format} (bullets/paragraphs/qa)
Include: key concepts, a step-by-step breakdown, examples, practice questions with answers, memory aids, summary, resources, and learning tips.`;

    fetch('https://api-inference.huggingface.co/models/google/flan-t5-large', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 850,
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.error || 'HTTP '+res.status);
          });
        }
        return res.json();
      })
      .then((data) => {
        const guide = data[0]?.generated_text || data.generated_text || data?.[0]?.text || null;
        if (!guide) {
          throw new Error('No text returned from model');
        }
        hideError();
        displayGuide(guide);
      })
      .catch((error) => {
        console.error('Hugging Face API error:', error);
        if (!isFallback) {
          showError('Direct Hugging Face API failed: ' + error.message + '. Falling back to mock AI.');
          const guide = createRevisionGuide(topic, level, format);
          displayGuide(guide);
        } else {
          showError('All AI attempts failed: ' + error.message + '. Using local mock AI.');
          const guide = createRevisionGuide(topic, level, format);
          displayGuide(guide);
        }
      });
  }

  function markdownToHtml(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<p>')
      .replace(/\n/g, '<br>');
  }

  function splitGuideToSections(guide) {
    const lines = guide.split(/\r?\n/);
    const sections = [];
    let current = { title: 'Guide', content: '' };
    const headingRegex = /^\*\*(.*?)\*\*\s*:?\s*$/;

    for (const line of lines) {
      const match = line.match(headingRegex);
      if (match) {
        if (current.content.trim()) {
          sections.push(current);
        }
        current = { title: match[1].trim(), content: '' };
      } else {
        if (line.trim() === '') {
          current.content += '\n';
        } else {
          current.content += (current.content ? '\n' : '') + line;
        }
      }
    }

    if (current.content.trim()) {
      sections.push(current);
    }

    if (!sections.length) {
      sections.push({ title: 'Guide', content: guide });
    }

    return sections;
  }

  function displayGuide(guide) {
    const tabs = document.getElementById('tabs');
    const sections = splitGuideToSections(guide);

    tabs.innerHTML = '';
    guideContent.innerHTML = '';

    const showSection = (idx) => {
      sections.forEach((_, i) => {
        const button = tabs.querySelectorAll('.tab-button')[i];
        if (button) button.classList.toggle('active', i === idx);
      });
      guideContent.innerHTML = markdownToHtml(sections[idx].content);
    };

    sections.forEach((section, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = section.title;
      button.className = 'tab-button' + (index === 0 ? ' active' : '');
      button.addEventListener('click', () => showSection(index));
      tabs.appendChild(button);
    });

    if (sections.length) {
      showSection(0);
    }

    output.classList.add('show');
    hideLoading();
  }

  function createRevisionGuide(topic, level, format) {
    // This is a mock AI generator. In a real implementation, this would call an AI API.
    const intro = getIntro(topic, level);
    const keyConcepts = getKeyConcepts(topic, level);
    const examples = getExamples(topic, level);
    const practice = getPracticeQuestions(topic, level);
    const memoryAids = getMemoryAids(topic, level);
    const summary = getSummary(topic, level);
    const resources = getResources(topic, level);

    let guide = '';

    if (format === 'bullets') {
      guide = `${intro}\n\n**Key Concepts:**\n${keyConcepts}\n\n**Detailed Examples:**\n${examples}\n\n**Practice Questions:**\n${practice}\n\n**Memory Aids:**\n${memoryAids}\n\n**Summary:**\n${summary}\n\n**Additional Resources:**\n${resources}`;
    } else if (format === 'paragraphs') {
      guide = `${intro}\n\n${keyConcepts}\n\n${examples}\n\n${practice}\n\n${memoryAids}\n\n${summary}\n\n${resources}`;
    } else if (format === 'qa') {
      guide = `${intro}\n\n**Q&A Section:**\n${practice}\n\n**Key Concepts Overview:**\n${keyConcepts}\n\n**Summary:**\n${summary}`;
    }

    return guide;
  }

  function getIntro(topic, level) {
    const intros = {
      beginner: `Welcome to your revision guide for ${topic}. This guide is designed for beginners, covering the fundamental concepts and building a strong foundation.`,
      intermediate: `This intermediate-level revision guide for ${topic} assumes you have basic knowledge and dives deeper into advanced concepts and applications.`,
      advanced: `Advanced revision guide for ${topic}. This comprehensive guide covers complex theories, cutting-edge developments, and practical applications for experts.`
    };
    return intros[level] || intros.beginner;
  }

  function getKeyConcepts(topic, level) {
    // Mock key concepts - in real AI, this would be generated
    const concepts = {
      beginner: `- Basic definition and overview of ${topic}\n- Core principles and fundamental rules\n- Essential components and their functions\n- Simple relationships between elements\n- Basic terminology and vocabulary\n- Foundational theories and historical context`,
      intermediate: `- Advanced theories and models\n- Complex relationships and interactions\n- Integration with related concepts\n- Real-world applications and case studies\n- Limitations and challenges\n- Current developments and trends`,
      advanced: `- Cutting-edge research and innovations\n- Theoretical frameworks and mathematical models\n- Interdisciplinary connections and applications\n- Ethical considerations and implications\n- Future directions and emerging technologies\n- Critical analysis and evaluation methods`
    };
    return `Key Concepts in ${topic}:\n${concepts[level]}`;
  }

  function getExamples(topic, level) {
    const examples = {
      beginner: `- Simple Example 1: A basic scenario demonstrating the core concept with step-by-step explanation\n- Simple Example 2: Another straightforward illustration showing practical application\n- Common Misconception: Addressing a typical error and providing the correct understanding\n- Real-life Analogy: Relating the concept to everyday experiences for better comprehension`,
      intermediate: `- Case Study 1: In-depth analysis of a real-world application with detailed breakdown\n- Practical Application: Step-by-step implementation in a complex scenario\n- Comparative Analysis: Examining different approaches and their outcomes\n- Problem-Solving Exercise: Working through a multi-step challenge`,
      advanced: `- Research Example: Analysis of a complex, real-world research scenario with mathematical derivation\n- Theoretical Example: Exploring abstract concepts through advanced modeling\n- Interdisciplinary Application: Connecting ${topic} with other fields of study\n- Innovation Case: Examining cutting-edge developments and their implications`
    };
    return `Detailed Examples:\n${examples[level]}`;
  }

  function getPracticeQuestions(topic, level) {
    const questions = {
      beginner: `1. What is the basic definition of ${topic}? Provide a simple explanation.\n2. Can you identify and describe the core components of ${topic}?\n3. Explain a simple example of ${topic} in your own words.\n4. What are the fundamental principles or rules governing ${topic}?\n5. How does ${topic} relate to everyday life or common experiences?`,
      intermediate: `1. How does ${topic} integrate with or differ from related concepts?\n2. Analyze a real-world application of ${topic} and discuss its implications.\n3. What are the limitations or challenges associated with ${topic}?\n4. Compare and contrast different approaches or methods within ${topic}.\n5. How might current trends in ${topic} impact future developments?`,
      advanced: `1. Critique the theoretical foundations of ${topic} and discuss alternative perspectives.\n2. Propose a novel application or extension of ${topic} in an emerging field.\n3. Discuss the ethical considerations and societal implications of advanced ${topic}.\n4. Evaluate the strengths and weaknesses of current research methodologies in ${topic}.\n5. Predict future research directions and potential breakthroughs in ${topic}.`
    };
    return `Practice Questions:\n${questions[level]}`;
  }

  function getMemoryAids(topic, level) {
    const aids = {
      beginner: `- Acronym: Create a memorable acronym using the first letters of key terms\n- Mnemonic: Develop a simple story or phrase to remember sequences\n- Visual aids: Draw simple diagrams or mind maps`,
      intermediate: `- Mind map: Create interconnected diagrams showing relationships\n- Flowchart: Map out processes and decision points\n- Comparison tables: Organize information in tabular format`,
      advanced: `- Conceptual framework: Build mental models of complex systems\n- Research matrix: Compare multiple theories or approaches\n- Critical analysis templates: Develop frameworks for evaluation`
    };
    return `Memory Aids:\n${aids[level]}`;
  }

  function getSummary(topic, level) {
    const summaries = {
      beginner: `In summary, ${topic} forms the foundation of [related field]. Mastering these basic concepts will prepare you for more advanced study. Regular review and practice are essential for retention.`,
      intermediate: `This intermediate exploration of ${topic} reveals the complexity and interconnectedness of the subject. Understanding these concepts requires both theoretical knowledge and practical application.`,
      advanced: `Advanced study of ${topic} demonstrates the cutting-edge developments and theoretical depth of the field. Continued research and critical analysis are necessary to stay current in this rapidly evolving area.`
    };
    return summaries[level];
  }

  function getResources(topic, level) {
    const resources = {
      beginner: `- Online tutorials and videos\n- Introductory textbooks\n- Practice worksheets\n- Study groups for peer learning`,
      intermediate: `- Academic journals and articles\n- Case studies and real-world applications\n- Advanced textbooks\n- Professional forums and communities`,
      advanced: `- Research papers and theses\n- Conference proceedings\n- Specialized software tools\n- Expert networks and collaborations`
    };
    return `Recommended Resources:\n${resources[level]}`;
  }

  function showLoading() {
    loading.style.display = 'block';
    output.classList.remove('show');
  }

  function hideLoading() {
    loading.style.display = 'none';
  }

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    hideLoading();
  }

  function hideError() {
    error.style.display = 'none';
  }

  function callHuggingFaceAPI(topic, level, format, apiKey) {
    const prompt = `Create a detailed revision guide for: "${topic}"
Study Level: ${level} (beginner/intermediate/advanced)
Format: ${format} (bullets/paragraphs/qa)
Include: key concepts, examples, practice questions, memory aids, summary, resources
Make it comprehensive and educational.`;

    fetch('https://api-inference.huggingface.co/models/google/flan-t5-large', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 1000,
          temperature: 0.7,
        },
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      const guide = data[0]?.generated_text || 'AI generation failed. Please try again.';
      displayGuide(guide);
    })
    .catch(error => {
      console.error('Error:', error);
      showError('AI generation failed: ' + error.message + '. Falling back to mock AI.');
      // Fallback to mock
      const guide = createRevisionGuide(topic, level, format);
      displayGuide(guide);
    });
  }
});
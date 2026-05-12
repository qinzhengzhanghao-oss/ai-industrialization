/**
 * AI 工业化 - API 调用模块
 * 调用 Seedance 2.0 API（通过 metamind.yun New API 网关）
 * 支持文生视频、图生视频、首尾帧控制、AI绘画
 * OpenAI 兼容接口格式
 */

const AI_API = {
  // API基础配置
  config: {
    apiKey: localStorage.getItem('ai_industrial_api_key') || '',
    baseUrl: 'https://metamind.yun',
    models: {
      video: 'doubao-seedance-2-0-260128',  // 视频生成模型
      image: '',  // 图片生成模型（暂时没有）
    },
    pollInterval: 5000,
    maxPollAttempts: 120
  },

  /**
   * 设置 API Key
   */
  setApiKey(key) {
    this.config.apiKey = key;
    localStorage.setItem('ai_industrial_api_key', key);
  },

  getApiKey() {
    return this.config.apiKey || localStorage.getItem('ai_industrial_api_key') || '';
  },

  /**
   * OpenAI 兼容接口调用
   */
  async _openaiRequest(endpoint, body) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('请先设置 API Key（右上角设置按钮）');

    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `请求失败: ${response.status}`;
      throw new Error(msg);
    }

    return data;
  },

  /**
   * GET 请求
   */
  async _openaiGet(endpoint) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('请先设置 API Key');

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || data?.message || '请求失败');
    return data;
  },

  /**
   * 文生视频
   */
  async textToVideo(prompt, options = {}) {
    if (!prompt?.trim()) throw new Error('请输入视频描述提示词');

    const resolutionMap = {
      '720p': '1280x720', '1080p': '1920x1080', '2k': '2048x1152'
    };
    const size = resolutionMap[options.resolution] || '1280x720';

    const body = {
      model: this.config.models.video,
      prompt: prompt.trim(),
      size: size,
      n: 1
    };

    // 额外参数通过 metadata/extensions 传递
    if (options.duration) body.duration = options.duration;
    if (options.cameraStyle && options.cameraStyle !== 'fixed') {
      body.prompt += ', camera motion: ' + options.cameraStyle;
    }
    if (options.audio !== false) body.audio = true;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
    if (options.speed) body.speed = options.speed;

    const data = await this._openaiRequest('/v1/video/generations', body);

    // New API 返回格式兼容
    const taskId = data?.data?.[0]?.id || data?.id || data?.task_id;

    return {
      taskId,
      rawResponse: data,
      status: 'queued'
    };
  },

  /**
   * 图生视频：先传图片再生成
   */
  async imageToVideo(imageFile, prompt, options = {}) {
    if (!imageFile) throw new Error('请上传图片');

    // 将图片转为 base64
    const base64 = await this._fileToBase64(imageFile);
    
    // 先上传图片
    const uploadBody = {
      model: this.config.models.video,
      prompt: prompt || 'animate this image',
      image: `data:${imageFile.type};base64,${base64}`,
      n: 1
    };

    if (options.resolution) {
      const resolutionMap = {
        '720p': '1280x720', '1080p': '1920x1080', '2k': '2048x1152'
      };
      uploadBody.size = resolutionMap[options.resolution] || '1920x1080';
    }

    const data = await this._openaiRequest('/v1/video/generations', uploadBody);
    
    const taskId = data?.data?.[0]?.id || data?.id || data?.task_id;

    return {
      taskId,
      rawResponse: data,
      status: 'queued'
    };
  },

  /**
   * 首尾帧
   */
  async frameToFrame(firstFrame, lastFrame, prompt, options = {}) {
    if (!firstFrame) throw new Error('请上传首帧图片');

    const base64First = await this._fileToBase64(firstFrame);
    const body = {
      model: this.config.models.video,
      prompt: prompt || 'smooth transition',
      image: `data:${firstFrame.type};base64,${base64First}`,
      n: 1
    };

    if (lastFrame) {
      const base64Last = await this._fileToBase64(lastFrame);
      body.end_image = `data:${lastFrame.type};base64,${base64Last}`;
    }

    const data = await this._openaiRequest('/v1/video/generations', body);
    
    const taskId = data?.data?.[0]?.id || data?.id || data?.task_id;

    return {
      taskId,
      rawResponse: data,
      status: 'queued'
    };
  },

  /**
   * 轮询任务状态
   * New API 用 /v1/video/retrieve 查询
   */
  async pollTask(taskId, onProgress) {
    if (!taskId) throw new Error('无效的任务ID');

    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        const data = await this._openaiRequest('/v1/video/retrieve', {
          model: this.config.models.video,
          id: taskId
        });

        // 兼容多种返回格式
        const status = (data?.data?.[0]?.status || data?.status || '').toLowerCase();
        const videoUrl = data?.data?.[0]?.url || data?.url || data?.output || data?.result || '';

        if (onProgress) onProgress(status);

        if (status === 'completed' || status === 'success' || status === 'done' || videoUrl) {
          return { status: 'completed', videoUrl, rawResponse: data };
        }

        if (status === 'failed' || status === 'error') {
          throw new Error(data?.error?.message || '视频生成失败');
        }

        if (attempts >= this.config.maxPollAttempts) {
          throw new Error('任务超时，请稍后查询');
        }

        await new Promise(r => setTimeout(r, this.config.pollInterval));
        return poll();

      } catch (err) {
        if (err.message.includes('超时') || err.message.includes('失败')) throw err;
        if (attempts < 5) {
          await new Promise(r => setTimeout(r, this.config.pollInterval));
          return poll();
        }
        throw err;
      }
    };

    return poll();
  },

  /**
   * 下载视频
   */
  async downloadVideo(url, filename) {
    if (!url) throw new Error('视频URL不可用');

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('下载失败');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || `ai-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 100);
    } catch (e) {
      window.open(url, '_blank');
    }
  },

  /**
   * 获取可用模型列表
   */
  async listModels() {
    const data = await this._openaiGet('/v1/models');
    return data?.data || [];
  },

  /**
   * 检查API连接和余额
   */
  async checkStatus() {
    const models = await this.listModels();
    return {
      connected: true,
      models: models.length,
      modelList: models.map(m => m.id)
    };
  },

  /** 文件转 base64 */
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('未提供文件'));
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === 'string' && result.includes('base64,')
          ? result.split('base64,')[1] : result);
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }
};

/**
 * AI 工业化 - API 调用模块
 * 调用 Seedance 视频生成 API（通过 metamind.yun new-api 网关）
 * 支持文生视频、图生视频、首尾帧控制
 * 完全符合 new-api /v1/video/generations 接口规范
 */

const AI_API = {
  config: {
    apiKey: localStorage.getItem('ai_industrial_api_key') || '',
    baseUrl: 'https://metamind.yun/v1',
    pollInterval: 5000,
    maxPollAttempts: 60
  },

  setApiKey(key) {
    this.config.apiKey = key;
    localStorage.setItem('ai_industrial_api_key', key);
  },

  getApiKey() {
    return this.config.apiKey || localStorage.getItem('ai_industrial_api_key') || '';
  },

  /** HEADERS */
  _headers() {
    const key = this.getApiKey();
    if (!key) throw new Error('请先设置 API Key');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    };
  },

  /**
   * ============ 1. 提交视频生成任务 ============
   * POST /v1/video/generations
   */
  async textToVideo(prompt, options = {}) {
    if (!prompt?.trim()) throw new Error('请输入视频描述提示词');

    const body = {
      model: 'seedance-2.0',
      prompt: prompt.trim(),
      metadata: {
        generate_audio: options.audio !== false,
        ratio: this._getRatio(options.ratio),
        duration: options.duration || 5,
        watermark: false
      }
    };

    // 运镜风格（拼入 prompt）
    if (options.cameraStyle && options.cameraStyle !== 'fixed') {
      const motionMap = {
        push: '镜头缓缓推近',
        pull: '镜头缓缓拉远',
        left: '镜头从右向左平移',
        right: '镜头从左向右平移',
        rotate: '镜头环绕旋转',
        up: '镜头向上移动',
        down: '镜头向下移动'
      };
      body.prompt += `，${motionMap[options.cameraStyle] || options.cameraStyle}`;
    }

    return this._submit(body);
  },

  /**
   * 图生视频
   */
  async imageToVideo(imageFile, prompt, options = {}) {
    if (!imageFile) throw new Error('请上传图片');

    // 上传图片到可访问的临时地址
    const imageUrl = await this._uploadImage(imageFile);

    const body = {
      model: 'seedance-2.0',
      prompt: prompt || 'animate this image',
      images: [imageUrl],
      metadata: {
        generate_audio: options.audio !== false,
        ratio: this._getRatio(options.ratio),
        duration: options.duration || 5,
        watermark: false
      }
    };

    return this._submit(body);
  },

  /**
   * 首尾帧控制（两张图片作为参考）
   */
  async frameToFrame(firstFrame, lastFrame, prompt, options = {}) {
    if (!firstFrame) throw new Error('请上传首帧图片');

    const images = [await this._uploadImage(firstFrame)];
    if (lastFrame) {
      images.push(await this._uploadImage(lastFrame));
    }

    const body = {
      model: 'seedance-2.0',
      prompt: prompt || '首帧到尾帧平滑过渡',
      images,
      metadata: {
        generate_audio: options.audio !== false,
        ratio: this._getRatio(options.ratio),
        duration: options.duration || 5,
        watermark: false
      }
    };

    return this._submit(body);
  },

  /** 统一提交任务 */
  async _submit(body) {
    const resp = await fetch(`${this.config.baseUrl}/video/generations`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || data?.message || `请求失败: ${resp.status}`);
    }

    // new-api 返回 { id, task_id, status: "queued", ... }
    const taskId = data.id || data.task_id;
    if (!taskId) throw new Error('API 未返回任务ID');

    return { taskId, status: 'queued' };
  },

  /**
   * ============ 2. 查询任务状态 ============
   * GET /v1/video/generations/{task_id}
   */
  async pollTask(taskId, onProgress) {
    if (!taskId) throw new Error('无效的任务ID');
    let attempts = 0;

    const poll = async () => {
      attempts++;
      const resp = await fetch(
        `${this.config.baseUrl}/video/generations/${taskId}`,
        { headers: this._headers() }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.error?.message || '查询失败');

      // new-api 返回 code+data 格式
      const info = result.data || result;
      const status = (info.status || '').toUpperCase();
      const progress = info.progress || '0%';
      const failReason = info.fail_reason || '';

      if (onProgress) onProgress(status, progress);

      if (status === 'SUCCESS') {
        // 多种位置取视频URL
        const url = info.result_url
          || info.data?.result_url
          || info.data?.data?.result_url
          || info.data?.data?.content?.video_url
          || '';
        return { status: 'completed', videoUrl: url, progress: '100%' };
      }

      if (status === 'FAILED' || status === 'FAILURE') {
        throw new Error(failReason || '视频生成失败');
      }

      if (attempts >= this.config.maxPollAttempts) {
        throw new Error('任务超时');
      }

      await new Promise(r => setTimeout(r, this.config.pollInterval));
      return poll();
    };

    return poll();
  },

  /**
   * 下载视频
   */
  async downloadVideo(url, filename) {
    if (!url) throw new Error('视频URL不可用');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ai-video-${Date.now()}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  },

  /**
   * 检查API状态
   */
  async checkStatus() {
    try {
      const resp = await fetch(`${this.config.baseUrl}/models`, {
        headers: this._headers()
      });
      const data = await resp.json();
      return { connected: resp.ok, models: data?.data?.length || 0 };
    } catch {
      return { connected: false, models: 0 };
    }
  },

  /** ========== 工具函数 ========== */

  _getRatio(ratio) {
    const map = { '16:9': '16:9', '9:16': '9:16', '1:1': '1:1' };
    return map[ratio] || '16:9';
  },

  /**
   * 图片上传 — 这里需要用户的图床/文件服务
   * 目前方案：通过 data URL 内嵌方式，但需要服务端支持 base64 图片
   * 如果 new-api 不支持直接传 base64，需要先自行上传到图床
   * 作为回退，尝试用 FileReader 构造临时 URL
   */
  async _uploadImage(file) {
    // 方案1：尝试直接用 File object 上传（需服务器支持 multipart）
    // 方案2：转为 data URL（某些 API 不支持大 base64）
    // 方案3：提示用户先上传图片到图床
    // 这里先用 data URL 方式，API 不支持时提示用户
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }
};

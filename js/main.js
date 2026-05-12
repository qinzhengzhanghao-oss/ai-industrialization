/**
 * AI 工业化 - 主逻辑模块
 * 所有页面共享的 JavaScript
 */

(function() {
  'use strict';

  // ============================================
  // 导航栏交互
  // ============================================
  
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      navLinks.classList.toggle('open');
    });

    // 点击页面其他区域关闭导航菜单
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.glass-nav')) {
        navLinks.classList.remove('open');
      }
    });

    // 点击导航链接后关闭菜单
    navLinks.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navLinks.classList.remove('open');
      });
    });
  }

  // ============================================
  // 页面切换逻辑
  // ============================================
  
  function navigateTo(url) {
    window.location.href = url;
  }

  // ============================================
  // 通用工具函数
  // ============================================
  
  /**
   * 防抖函数
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 延迟时间(ms)
   * @returns {Function} 防抖后的函数
   */
  function debounce(fn, delay) {
    let timer = null;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  }

  /**
   * 节流函数
   * @param {Function} fn - 要执行的函数
   * @param {number} limit - 间隔时间(ms)
   * @returns {Function} 节流后的函数
   */
  function throttle(fn, limit) {
    let inThrottle = false;
    return function() {
      const context = this;
      const args = arguments;
      if (!inThrottle) {
        fn.apply(context, args);
        inThrottle = true;
        setTimeout(function() {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * 格式化时间
   * @param {Date|number} date - 日期或时间戳
   * @param {string} format - 格式模板
   * @returns {string} 格式化后的时间字符串
   */
  function formatDate(date, format) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    format = format || 'YYYY-MM-DD HH:mm';
    const map = {
      'YYYY': d.getFullYear(),
      'MM': String(d.getMonth() + 1).padStart(2, '0'),
      'DD': String(d.getDate()).padStart(2, '0'),
      'HH': String(d.getHours()).padStart(2, '0'),
      'mm': String(d.getMinutes()).padStart(2, '0'),
      'ss': String(d.getSeconds()).padStart(2, '0')
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, function(matched) {
      return map[matched];
    });
  }

  /**
   * 显示通知
   * @param {string} message - 通知内容
   * @param {string} type - 通知类型 (success|error|info|warning)
   * @param {number} duration - 显示时长(ms)
   */
  function showNotification(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    // 移除已有通知
    const existing = document.querySelector('.app-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'app-notification';
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: ${type === 'success' ? 'rgba(29, 185, 84, 0.9)' : 
                   type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                   type === 'warning' ? 'rgba(245, 158, 11, 0.9)' : 
                   'rgba(124, 58, 237, 0.9)'};
      backdrop-filter: blur(20px);
      color: white;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    `;

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    notification.innerHTML = `<span style="margin-right: 8px;">${iconMap[type] || 'ℹ'}</span>${message}`;
    document.body.appendChild(notification);

    // 入场动画
    requestAnimationFrame(function() {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(-50%) translateY(0)';
    });

    // 自动消除
    setTimeout(function() {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(function() {
        if (notification.parentNode) notification.remove();
      }, 300);
    }, duration);
  }

  /**
   * 获取 DOM 元素的文本内容(修剪后)
   * @param {string|Element} selector - CSS选择器或DOM元素
   * @returns {string}
   */
  function getText(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    return el ? el.textContent.trim() : '';
  }

  /**
   * 设置 DOM 元素的内容
   * @param {string|Element} selector - CSS选择器或DOM元素
   * @param {string} content - 要设置的内容
   */
  function setText(selector, content) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) el.textContent = content;
  }

  /**
   * 生成唯一ID
   * @returns {string}
   */
  function uniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 延时函数
   * @param {number} ms - 延时毫秒数
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * 检测浏览器是否支持 WebP
   * @returns {Promise<boolean>}
   */
  function supportsWebP() {
    return new Promise(function(resolve) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const data = canvas.toDataURL('image/webp');
      resolve(data.indexOf('image/webp') === 5);
    });
  }

  /**
   * 下载文件
   * @param {string} url - 文件URL
   * @param {string} filename - 文件名
   */
  function downloadFile(url, filename) {
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>} 是否成功
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (e2) {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  // ============================================
  // 导出全局 API
  // ============================================
  
  window.App = {
    navigateTo: navigateTo,
    debounce: debounce,
    throttle: throttle,
    formatDate: formatDate,
    showNotification: showNotification,
    getText: getText,
    setText: setText,
    uniqueId: uniqueId,
    sleep: sleep,
    downloadFile: downloadFile,
    copyToClipboard: copyToClipboard
  };

})();

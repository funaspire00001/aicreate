import express from 'express';
import Workspace from '../models/Workspace.js';
import Agent from '../models/Agent.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * 获取所有空间
 */
router.get('/', async (req, res) => {
  try {
    let workspaces = await Workspace.find().sort({ createdAt: -1 });
    
    // 如果没有空间，创建默认空间
    if (workspaces.length === 0) {
      const defaultWorkspace = await Workspace.create({
        id: 'space_default',
        name: '默认空间',
        description: '系统默认空间',
        agentIds: [],
        isDefault: true
      });
      workspaces = [defaultWorkspace];
    }
    
    res.json({
      success: true,
      workspaces
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个空间
 */
router.get('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (workspace) {
      res.json({
        success: true,
        workspace
      });
    } else {
      res.status(404).json({
        success: false,
        error: '空间不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建空间
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, agentIds } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '空间名称不能为空'
      });
    }
    
    // 生成带前缀的唯一ID
    const spaceId = `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newWorkspace = new Workspace({
      id: spaceId,
      name,
      description: description || '',
      agentIds: agentIds || []
    });
    
    await newWorkspace.save();
    
    res.json({
      success: true,
      workspace: newWorkspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新空间
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, description, agentIds } = req.body;
    
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: '空间不存在'
      });
    }
    
    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (agentIds !== undefined) workspace.agentIds = agentIds;
    
    await workspace.save();
    
    res.json({
      success: true,
      workspace,
      message: '空间已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除空间
 */
router.delete('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: '空间不存在'
      });
    }
    
    // 默认空间不能删除
    if (workspace.isDefault) {
      return res.status(400).json({
        success: false,
        error: '默认空间不能删除'
      });
    }
    
    await Workspace.deleteOne({ id: req.params.id });
    
    res.json({
      success: true,
      message: '空间删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取空间下的智能体
 */
router.get('/:id/agents', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: '空间不存在'
      });
    }
    
    // 根据 agentIds 获取智能体详情
    const agents = await Agent.find({
      id: { $in: workspace.agentIds || [] }
    });
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

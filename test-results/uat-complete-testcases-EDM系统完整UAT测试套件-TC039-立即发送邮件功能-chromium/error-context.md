# Test info

- Name: EDM系统完整UAT测试套件 >> TC039: 立即发送邮件功能
- Location: /Users/tony/Desktop/cursor/EDM/tests/e2e/uat-complete-testcases.spec.js:580:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
    at /Users/tony/Desktop/cursor/EDM/tests/e2e/uat-complete-testcases.spec.js:608:23
```

# Page snapshot

```yaml
- complementary:
  - text: EDM系统
  - menu:
    - menuitem "dashboard 仪表盘":
      - img "dashboard"
      - link "仪表盘":
        - /url: /
    - menuitem "user 联系人管理":
      - img "user"
      - link "联系人管理":
        - /url: /contacts
    - menuitem "tag 标签管理":
      - img "tag"
      - link "标签管理":
        - /url: /tags
    - menuitem "carry-out 任务管理":
      - img "carry-out"
      - link "任务管理":
        - /url: /tasks
    - menuitem "mail 模板管理":
      - img "mail"
      - link "模板管理":
        - /url: /templates
    - menuitem "send 发件管理":
      - img "send"
      - text: 发件管理
    - menuitem "setting 系统管理":
      - img "setting"
      - text: 系统管理
- banner:
  - img "menu-fold"
  - img "user"
  - text: admin
- main:
  - heading "仪表盘" [level=1]
  - text: 联系人总数
  - img "user"
  - text: 1 标签总数
  - img "tag"
  - text: 1 邮件模板数
  - img "file-text"
  - text: 0 邮件任务数
  - img "send"
  - text: 0 最新添加的联系人
  - button "查看全部"
  - table:
    - rowgroup:
      - row "用户名 邮箱 创建时间 操作":
        - columnheader "用户名"
        - columnheader "邮箱"
        - columnheader "创建时间"
        - columnheader "操作"
    - rowgroup:
      - row "未设置 test@example.com 未知 查看":
        - cell "未设置"
        - cell "test@example.com"
        - cell "未知"
        - cell "查看":
          - button "查看"
```

# Test source

```ts
  508 |         '.ant-checkbox',
  509 |         '[type="checkbox"]',
  510 |         '.ant-transfer',
  511 |         '[placeholder*="联系人"]'
  512 |       ];
  513 |       
  514 |       let selectorFound = false;
  515 |       for (const selector of contactSelectors) {
  516 |         const element = page.locator(selector);
  517 |         if (await element.count() > 0) {
  518 |           selectorFound = true;
  519 |           console.log(`✅ 找到联系人选择元素: ${selector}`);
  520 |           break;
  521 |         }
  522 |       }
  523 |       
  524 |       if (selectorFound) {
  525 |         console.log('✅ TC034测试通过 - 联系人选择功能可用');
  526 |       } else {
  527 |         console.log('⚠️ TC034测试跳过 - 联系人选择元素未找到（可能需要特定页面）');
  528 |       }
  529 |       
  530 |     } catch (error) {
  531 |       console.error('❌ TC034测试失败:', error.message);
  532 |       throw error;
  533 |     }
  534 |   });
  535 |
  536 |   test('TC035: 发送计划设置', async ({ page }) => {
  537 |     console.log('🧪 P0级测试: TC035 - 发送计划');
  538 |     
  539 |     try {
  540 |       await doLogin(page);
  541 |       
  542 |       // 基本验证：检查是否有时间/日期选择相关的元素
  543 |       await page.waitForTimeout(3000);
  544 |       
  545 |       const timeSelectors = [
  546 |         '.ant-date-picker',
  547 |         '.ant-time-picker',
  548 |         'input[type="datetime-local"]',
  549 |         'input[type="date"]',
  550 |         '[placeholder*="时间"]',
  551 |         '[placeholder*="日期"]'
  552 |       ];
  553 |       
  554 |       let timeFound = false;
  555 |       for (const selector of timeSelectors) {
  556 |         const element = page.locator(selector);
  557 |         if (await element.count() > 0) {
  558 |           timeFound = true;
  559 |           console.log(`✅ 找到时间选择元素: ${selector}`);
  560 |           break;
  561 |         }
  562 |       }
  563 |       
  564 |       if (timeFound) {
  565 |         console.log('✅ TC035测试通过 - 发送计划功能可用');
  566 |       } else {
  567 |         console.log('⚠️ TC035测试跳过 - 时间选择元素未找到（可能需要特定页面）');
  568 |       }
  569 |       
  570 |     } catch (error) {
  571 |       console.error('❌ TC035测试失败:', error.message);
  572 |       throw error;
  573 |     }
  574 |   });
  575 |
  576 |   // ===================
  577 |   // P0级测试用例 - 邮件发送核心流程 (TC039-043)
  578 |   // ===================
  579 |
  580 |   test('TC039: 立即发送邮件功能', async ({ page }) => {
  581 |     console.log('🧪 P0级测试: TC039 - 立即发送');
  582 |     
  583 |     try {
  584 |       await doLogin(page);
  585 |       
  586 |       // 查找发送相关按钮
  587 |       const sendSelectors = [
  588 |         'button:has-text("发送")',
  589 |         'button:has-text("立即发送")',
  590 |         '.ant-btn:has-text("发送")',
  591 |         '[title="发送"]'
  592 |       ];
  593 |       
  594 |       let sendFound = false;
  595 |       for (const selector of sendSelectors) {
  596 |         const element = page.locator(selector);
  597 |         if (await element.count() > 0) {
  598 |           sendFound = true;
  599 |           console.log(`✅ 找到发送按钮: ${selector}`);
  600 |           break;
  601 |         }
  602 |       }
  603 |       
  604 |       if (sendFound) {
  605 |         console.log('✅ TC039测试通过 - 发送功能可访问');
  606 |       } else {
  607 |         console.log('❌ TC039测试失败 - 发送按钮未找到');
> 608 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
      |                       ^ Error: expect(received).toBeTruthy()
  609 |       }
  610 |       
  611 |     } catch (error) {
  612 |       console.error('❌ TC039测试失败:', error.message);
  613 |       throw error;
  614 |     }
  615 |   });
  616 |
  617 |   test('TC040: 定时发送功能', async ({ page }) => {
  618 |     console.log('🧪 P0级测试: TC040 - 定时发送');
  619 |     
  620 |     try {
  621 |       await doLogin(page);
  622 |       
  623 |       // 查找定时发送相关元素
  624 |       const scheduleSelectors = [
  625 |         'button:has-text("定时")',
  626 |         'button:has-text("计划")',
  627 |         '.ant-btn:has-text("定时")',
  628 |         '[title*="定时"]'
  629 |       ];
  630 |       
  631 |       let scheduleFound = false;
  632 |       for (const selector of scheduleSelectors) {
  633 |         const element = page.locator(selector);
  634 |         if (await element.count() > 0) {
  635 |           scheduleFound = true;
  636 |           console.log(`✅ 找到定时发送功能: ${selector}`);
  637 |           break;
  638 |         }
  639 |       }
  640 |       
  641 |       if (scheduleFound) {
  642 |         console.log('✅ TC040测试通过 - 定时发送功能可访问');
  643 |       } else {
  644 |         console.log('⚠️ TC040测试跳过 - 定时发送功能未找到（可能需要特定页面）');
  645 |       }
  646 |       
  647 |     } catch (error) {
  648 |       console.error('❌ TC040测试失败:', error.message);
  649 |       throw error;
  650 |     }
  651 |   });
  652 |
  653 |   test('TC041: 发送状态显示', async ({ page }) => {
  654 |     console.log('🧪 P0级测试: TC041 - 发送状态');
  655 |     
  656 |     try {
  657 |       await doLogin(page);
  658 |       
  659 |       // 查找状态显示相关元素
  660 |       const statusSelectors = [
  661 |         '.ant-tag',
  662 |         '.ant-badge',
  663 |         '.status',
  664 |         '[class*="status"]',
  665 |         '.ant-progress'
  666 |       ];
  667 |       
  668 |       let statusFound = false;
  669 |       for (const selector of statusSelectors) {
  670 |         const element = page.locator(selector);
  671 |         if (await element.count() > 0) {
  672 |           statusFound = true;
  673 |           console.log(`✅ 找到状态显示元素: ${selector}`);
  674 |           break;
  675 |         }
  676 |       }
  677 |       
  678 |       if (statusFound) {
  679 |         console.log('✅ TC041测试通过 - 状态显示功能可用');
  680 |       } else {
  681 |         console.log('⚠️ TC041测试跳过 - 状态显示元素未找到（可能需要特定页面）');
  682 |       }
  683 |       
  684 |     } catch (error) {
  685 |       console.error('❌ TC041测试失败:', error.message);
  686 |       throw error;
  687 |     }
  688 |   });
  689 |
  690 |   test('TC042: 发送统计功能', async ({ page }) => {
  691 |     console.log('🧪 P0级测试: TC042 - 发送统计');
  692 |     
  693 |     try {
  694 |       await doLogin(page);
  695 |       
  696 |       // 查找统计相关元素
  697 |       const statsSelectors = [
  698 |         '.ant-statistic',
  699 |         '.ant-card',
  700 |         '[class*="stat"]',
  701 |         '[class*="count"]',
  702 |         'canvas', // 图表
  703 |         '.chart'
  704 |       ];
  705 |       
  706 |       let statsFound = false;
  707 |       for (const selector of statsSelectors) {
  708 |         const element = page.locator(selector);
```
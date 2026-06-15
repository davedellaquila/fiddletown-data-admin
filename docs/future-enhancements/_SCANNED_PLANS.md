# Cursor Plans Scan

Audit of `~/.cursor/plans/` for documents relevant to **ssa-admin-ios**.  
**Scanned:** 2026-06-15 by PM.

---

## Imported into this repo

| Source plan | Enhancement ID | Destination |
|-------------|----------------|-------------|
| `ad_management_system_prd_2c2e3fc8.plan.md` | FE-001 | [ad-management-system.md](./ad-management-system.md) |
| `ipad_app_with_shared_logic_architecture_0e209820.plan.md` | FE-003 | [ipad-shared-logic-architecture.md](./ipad-shared-logic-architecture.md) |
| `implement_repeating_events_functionality_14eb70ac.plan.md` | FE-002 | [smarter-repeat-events.md](./smarter-repeat-events.md) |
| `event_selection_and_email_notification_for_squarespace_users_61698064.plan.md` | FE-004 | [event-selection-email.md](./event-selection-email.md) |

---

## Reviewed — not imported (different project or scope)

| Source plan | Reason excluded |
|-------------|-----------------|
| `add_repeating_events_to_master_todo_8c81e09d.plan.md` | Meta-task only; absorbed into FE-002 |
| `wisdom_dashboard_product_description_aec5747b.plan.md` | Wisdom Library dashboard (separate product) |
| `milemarker_vc_fundraising_package_3ec0364f.plan.md` | VC fundraising (Milemarker) |
| `transaction_notes_receipts_42239d67.plan.md` | Transaction tracker |
| `pdf_transaction_extractor_e96e3336.plan.md` | PDF / transactions |
| `fetch_reviews_from_app_store_rss_f4ba3480.plan.md` | App Store review analyzer |
| `add_app_description_section_e4e54c33.plan.md` | App Store review analyzer |
| `drop_temperature_for_opus_4.7_1a5e7771.plan.md` | Claude API / review analyzer |
| `scaffold_review_and_runup_757bfef7.plan.md` | Review analyzer scaffold |
| `ux_behavior_documentation_e7ac9cd9.plan.md` | AG Grid prototype |
| `ag_grid_prototype_framework_f912bc64.plan.md` | AG Grid prototype |
| `data_grid_prototype_with_row_cell_selection_1c429f66.plan.md` | AG Grid prototype |
| `persistent_acv_ui_4a31c064.plan.md` | AG Grid / ACV UI |
| `add_account_number_column_2363da31.plan.md` | AG Grid prototype |
| `enable_shift+arrow_range_selection_for_cell_selection_762d7bce.plan.md` | AG Grid prototype |
| `add_option_to_disable_row_hover_highlighting_83f22448.plan.md` | AG Grid prototype |
| `add_clipboard_contents_display_to_configpanel_bcfaa28d.plan.md` | AG Grid prototype |
| `fix_checkbox_selection_on_keyboard_navigation_ecb3b36a.plan.md` | AG Grid prototype |
| `add_red_border_validation_for_non-numeric_values_2ddc3df4.plan.md` | AG Grid prototype |
| `add_blue_border_to_edited_cells_ac300612.plan.md` | AG Grid prototype |
| `mcp_server_examples_b0074638.plan.md` | MCP examples (generic) |

---

## Related project notes (not full PRDs)

Items in [TODO.md](../../TODO.md) that align with future enhancements:

- **Event Management** — session event selection / print (→ FE-004 email variant)
- **Frontend/UI** — bulk actions only when rows selected (→ [platform-ux-assessment](../backlog/platform-ux-assessment.md) P1)
- **Other Ideas** — sponsors footer (not yet specced)

---

## Re-scan procedure

When new plans appear in `~/.cursor/plans/`:

1. Grep for SSA, Squarespace, event-list, Fiddletown, sportscar, wineries, event_candidates
2. Import matches to `docs/future-enhancements/` with FE-### ID
3. Update this file and [README.md](./README.md) registry

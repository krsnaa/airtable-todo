import React, { useState } from "react";
import {
  initializeBlock,
  useBase, // will cause the component to re-render whenever the base name changes (it will also re-render when tables, fields, and views are created, updated, or deleted and when the current user's permission level changes).
  useRecords, // work w. records, for eg., show the number of records; Any time records are created, deleted, or updated in the table, our component will automatically re-render.
  expandRecord, // expand the record to enable editing
  TextButton,
  useGlobalConfig, // access data in globalConfig and automatically re-render when any of that data changes
  TablePickerSynced, // way for the user to pick a table
  ViewPickerSynced,
  FieldPickerSynced,
  FormField,
  Input,
  Button,
  Box,
  Icon,
} from "@airtable/blocks/ui";
import { FieldType } from "@airtable/blocks/models";

function TodoBlock() {
  const base = useBase();

  // Each block installation has a storage mechanism called globalConfig where you can store configuration information as JSON.
  // The contents of globalConfig will be synced in real-time to all logged in users of that block installation.
  // Read the user's choice for which table and view to use from globalConfig.
  const globalConfig = useGlobalConfig();

  const tableId = globalConfig.get("selectedTableId");
  const table = base.getTableByIdIfExists(tableId); // The table ID won't change when the table gets renamed.
  if (!table) if (base.tables.length === 1) globalConfig.setAsync("selectedTableId", base.tables[0].id);
  // base.getTableByName('Tasks'); or base.getTableByNameIfExists('Tasks');
  // base.getTableByName will crash the block if there's no table in the base with the specified name. base.getTableByNameIfExists will return null instead of crashing if there's no table with the specified name.

  const viewId = globalConfig.get("selectedViewId");
  const view = table ? table.getViewByIdIfExists(viewId) : null;
  if (!view) if (table && table.views.length === 1) globalConfig.setAsync("selectedViewId", table.views[0].id);
  console.log(view);

  const doneFieldId = globalConfig.get("selectedDoneFieldId");
  const doneField = table ? table.getFieldByIdIfExists(doneFieldId) : null;
  if (!doneField) {
    console.log("entered if (!doneFieldId) ");
    // if (table && table.fields.length === 1) globalConfig.setAsync("selectedTableId", base.tables[0].id);
    const checkBoxFields = table.fields.filter((field) => field.type === FieldType.CHECKBOX);
    if (checkBoxFields.length === 1) globalConfig.setAsync("selectedDoneFieldId", checkBoxFields[0].id);
  }
  console.log(doneField);

  console.log(tableId, viewId, doneFieldId);

  // const records = useRecords(view); // connect our TodoBlock component to the records inside the Table

  // We'll need an extra check to verify that the field still exists. If someone deletes the field, we don't want the task trying to lookup a cell value for a non-existent field!
  // Don't need to fetch records if doneField doesn't exist (the field or it's parent table may
  // have been deleted, or may not have been selected yet.)
  const records = useRecords(doneField ? view : null, {
    fields: doneField ? [table.primaryField, doneField] : [],
  });

  // records will be an ARRAY of Record objects.
  const tasks = records
    ? records.map((record) => {
        return <Task key={record.id} record={record} table={table} doneField={doneField} />;
      })
    : null;

  return (
    <div>
      {/* <div>{base.name}</div>
      <div>Number of tasks: {records.length}</div> */}

      <Box padding={3} borderBottom="thick">
        <FormField label="Table">
          {/*
          <TablePicker
                table={table}
                onChange={newTable => {
                    globalConfig.setAsync('selectedTableId', newTable.id);
                }}
            />
           */}

          {/* TablePickerSynced automatically reads and writes to globalConfig with the proper permission checks */}
          <TablePickerSynced globalConfigKey="selectedTableId" />
        </FormField>
        <FormField label="View">
          <ViewPickerSynced table={table} globalConfigKey="selectedViewId" />
        </FormField>
        <FormField label="Field" marginBottom={0}>
          <FieldPickerSynced
            table={table}
            globalConfigKey="selectedDoneFieldId"
            placeholder="Pick a 'done' field..."
            allowedTypes={[FieldType.CHECKBOX]}
          />
        </FormField>
      </Box>
      {tasks}
      {table && doneField && <AddTaskForm table={table} />}
    </div>
  );
}

function Task({ record, table, doneField }) {
  const label = record.name || "Unnamed record";
  return (
    <Box
      fontSize={4}
      paddingX={3}
      paddingY={2}
      marginRight={-2}
      borderBottom="default"
      display="flex"
      alignItems="center"
    >
      <TaskDoneCheckbox table={table} record={record} doneField={doneField} />
      <a
        style={{ cursor: "pointer", flex: "auto", padding: 8 }}
        onClick={() => {
          // expandRecord(record);
          toggle(table, record, doneField);
        }}
      >
        {record.getCellValue(doneField.id) ? <s style={{ color: "grey" }}>{label}</s> : label}
        {/* VM366 bundle.js:32229 [@airtable/blocks] record.primaryCellValueAsString is deprecated. Use record.name instead. */}
        {/* {record.primaryCellValueAsString || "Unnamed record"} */}
      </a>
      <TextButton
        icon="expand"
        aria-label="Expand record"
        onClick={() => {
          expandRecord(record);
        }}
      />
      <TaskDeleteButton table={table} record={record} />
    </Box>
  );
}

const toggle = (table, record, doneField) => {
  table.updateRecordAsync(record, { [doneField.id]: !record.getCellValue(doneField.id) });
};

function TaskDoneCheckbox({ table, record, doneField }) {
  function onChange(event) {
    // modify the record - need a table reference
    table.updateRecordAsync(record, {
      [doneField.id]: event.currentTarget.checked,
    });
  }

  const permissionCheck = table.checkPermissionsForUpdateRecord(record, {
    [doneField.id]: undefined,
  });

  return (
    <input
      type="checkbox"
      checked={!!record.getCellValue(doneField)}
      onChange={onChange}
      style={{ marginRight: 8 }}
      disabled={!permissionCheck.hasPermission}
    />
  );
}

function TaskDeleteButton({ table, record }) {
  function onClick() {
    table.deleteRecordAsync(record);
  }

  return (
    <Button variant="secondary" marginLeft={1} onClick={onClick} disabled={!table.hasPermissionToDeleteRecord(record)}>
      <Icon name="x" style={{ display: "flex" }} />
    </Button>
  );
}

function AddTaskForm({ table }) {
  // store the name in the component's state
  const [taskName, setTaskName] = useState("");

  function onInputChange(event) {
    setTaskName(event.currentTarget.value);
  }

  function onSubmit(event) {
    event.preventDefault();
    table.createRecordAsync({
      [table.primaryField.id]: taskName,
    });
    setTaskName("");
  }

  // check whether or not the user is allowed to create records with values in the primary field.
  // if not, disable the form.
  const isFormEnabled = table.hasPermissionToCreateRecord({
    [table.primaryField.id]: undefined,
  });
  return (
    <form onSubmit={onSubmit}>
      <Box display="flex" padding={3}>
        <Input flex="auto" value={taskName} placeholder="New task" onChange={onInputChange} disabled={!isFormEnabled} />
        <Button variant="primary" marginLeft={2} type="submit" disabled={!isFormEnabled}>
          Add
        </Button>
      </Box>
    </form>
  );
}

initializeBlock(() => <TodoBlock />);

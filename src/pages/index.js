import Head from 'next/head'
import { useState, useEffect } from 'react';
import { Web5 } from '@tbd54566975/web5';

export default function Todo() {
  const [web5Instance, setWeb5Instance] = useState(null);
  const [aliceDid, setAliceDid] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState({});
  const [expandedTaskIds, setExpandedTaskIds] = useState({});

  useEffect(() => {
    async function connectToWeb5() {
      setLoading(true);
      const { web5, did } = await Web5.connect();
      setWeb5Instance(web5);
      setAliceDid(did);


      const response = await web5.dwn.records.query({
        from: did,
        message: {
          filter: {
            dataFormat: 'application/json',
            schema: 'https://schema.org/Action',
          },
        },
      });

      const tasks = await Promise.all(
        response.records.map(async (record) => {
          try {
            const data = await record.data.json();

            return { id: record.id, text: data.name, subTasks: data.subTasks || [] };
          } catch (error) {
            console.error(`Error parsing record data as JSON: ${error}`);
            return null;
          }
        })
      );

      // Filter out any null values from the tasks array.
      const validTasks = tasks.filter((task) => task !== null);
      setTasks(validTasks);
      setLoading(false);
    }

    connectToWeb5();
  }, []);

  async function addTask(event) {
    event.preventDefault(); // Prevent form from submitting and refreshing the page
    if (web5Instance && aliceDid && newTask.trim() !== '') {
      const taskData = {
        '@context': 'https://schema.org/',
        '@type': 'Action',
        name: newTask,
        completed: false, // Add this line
        subTasks: [], // Initialize subTasks with an empty array
      };

      const { record } = await web5Instance.dwn.records.create({
        data: taskData,
        message: {
          dataFormat: 'application/json',
          schema: 'https://schema.org/Action',
        },
      });

      // Send the record to the DWN.
      await record.send(aliceDid);

      setTasks((prevTasks) => [...prevTasks, { id: record.id, text: newTask, subTasks: [] }]);
      setNewTask('');
    }
  }


  async function deleteTask(id) {
    if (web5Instance && aliceDid) {
      await web5Instance.dwn.records.delete({
        from: aliceDid,
        message: {
          recordId: id,
        },
      });
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    }
  }


  async function expandTask(id) {
    setLoadingTasks((prevLoadingTasks) => ({ ...prevLoadingTasks, [id]: true }));
    if (web5Instance && aliceDid) {
      const task = tasks.find((task) => task.id === id);

      // Check if subTasks field is already populated
      if (task.subTasks.length > 0) {
        console.log('Subtasks already populated. Not making API call.');
        // Toggle the visibility of the expanded task
        setExpandedTaskIds((prevExpandedTaskIds) => ({ ...prevExpandedTaskIds, [id]: !prevExpandedTaskIds[id] }));
        setLoadingTasks((prevLoadingTasks) => ({ ...prevLoadingTasks, [id]: false })); // Set loading to false here
        return;
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ tasks: [task.text] }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      // Set the visibility of the expanded task to true
      setExpandedTaskIds((prevExpandedTaskIds) => ({ ...prevExpandedTaskIds, [id]: true }));

      // Update the subTasks field in the DWN record and convert it into an array
      if (result.result && web5Instance) {
        const { record } = await web5Instance.dwn.records.read({
          from: aliceDid,
          message: {
            recordId: id,
          },
        });

        // Convert result.result into an array if it's not already
        const subTasksArray = Array.isArray(result.result) ? result.result : [result.result];
        const subTasksWithCompletion = subTasksArray.map(subTask => ({
          text: subTask,
          completed: false,
        }));

        const splitSubTasks = subTasksWithCompletion.flatMap(subTask => {
          const splitText = subTask.text.split(/(?=^\d+\.\s)/gm);
          return splitText.map(text => ({ text, completed: false }));
        });

        await record.update({
          data: { ...record.data, name: task.text, subTasks: splitSubTasks }
        });
        await record.send(aliceDid);

        // Update the local state with the subTasks
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task.id === id ? { ...task, subTasks: splitSubTasks } : task))
        );
      }
      setLoadingTasks((prevLoadingTasks) => ({ ...prevLoadingTasks, [id]: false })); // Set loading to false here
    }
  }



  function handleCheckboxClick(taskId, subTaskIndex = null) {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          if (subTaskIndex !== null) {
            // A subtask checkbox was clicked
            const subTasks = task.subTasks.map((subTask, index) =>
              index === subTaskIndex ? { ...subTask, completed: !subTask.completed } : subTask
            );
            return { ...task, subTasks };
          } else {
            // A main task checkbox was clicked
            return { ...task, completed: !task.completed };
          }
        } else {
          return task;
        }
      })
    );
  }

  return (
    <div>
      <Head>
        <title>Time blind</title>
      </Head>
      <h1>Time Blind</h1>
      <p>A reality check for folks who think they can do it all in a short amount of time</p>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>

          <ul>
            <form className="add-task-container" onSubmit={addTask}>
              <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task" />
              <button type="submit">Add task</button>
            </form>
            {tasks.map((task, index) => (
              <li key={index} className="main-task">
                <div className="tasks-container">
                  <div className="main-task-container">
                    <input type="checkbox" checked={task.completed} onChange={() => handleCheckboxClick(task.id)} id={`main-task-${index}`} name={`main-task-${index}`} />
                    <label htmlFor={`main-task-${index}`}>{task.text}</label>
                  </div>
                  <div className="action-buttons">
                    <button className="action-button" onClick={() => deleteTask(task.id)}>Delete</button>
                    <button className="action-button" onClick={() => expandTask(task.id)}>
                      {expandedTaskIds[task.id] ? ' - ' : ' + '}
                    </button>
                  </div>
                </div>
                {loadingTasks[task.id] ? (
                  <div>The AI is breaking down your task...</div>
                ) : expandedTaskIds[task.id] && Array.isArray(task.subTasks) && task.subTasks.length > 0 ? (
                  <div>
                    <ul>
                      {task.subTasks.map((subTask, subIndex) => (
                        <li key={subIndex} className="sub-task">
                          <ul>
                            {subTask.text.split(/(?=^\d+\.\s)/gm).map((item, index) => (
                              <li key={index}>
                                <input type="checkbox" checked={subTask.completed} onChange={() => handleCheckboxClick(task.id, subIndex)} id={`task-${index}`} name={`task-${index}`} />
                                <label htmlFor={`task-${index}`}>{item}</label>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

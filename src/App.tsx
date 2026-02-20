import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './components/ThemeProvider'
import { ToastProvider } from './components/Toast'
import { TaskListSkeleton, ProjectGridSkeleton } from './components/Skeleton'

const Today = lazy(() => import('./pages/Today'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Projects = lazy(() => import('./pages/Projects'))
const Login = lazy(() => import('./pages/Login'))

const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Settings = lazy(() => import('./pages/Settings'))

import { ShortcutProvider } from './context/ShortcutContext'
import { TaskProvider } from './context/TaskContext'

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ShortcutProvider>
                    <TaskProvider>
                        <ToastProvider>
                            <Suspense fallback={<div className="h-screen bg-background" />}>
                                <Routes>
                                    <Route path="/login" element={<Login />} />


                                    {/* Protected Routes */}
                                    <Route
                                        element={
                                            <ErrorBoundary>
                                                <AuthGuard>
                                                    <Layout />
                                                </AuthGuard>
                                            </ErrorBoundary>
                                        }
                                    >
                                        <Route index element={<Navigate to="/today" replace />} />
                                        <Route
                                            path="today"
                                            element={
                                                <Suspense fallback={<TaskListSkeleton />}>
                                                    <Today />
                                                </Suspense>
                                            }
                                        />
                                        <Route
                                            path="tasks"
                                            element={
                                                <Suspense fallback={<TaskListSkeleton />}>
                                                    <Tasks />
                                                </Suspense>
                                            }
                                        />
                                        <Route
                                            path="projects"
                                            element={
                                                <Suspense fallback={<ProjectGridSkeleton />}>
                                                    <Projects />
                                                </Suspense>
                                            }
                                        />
                                        <Route
                                            path="projects/:id"
                                            element={
                                                <Suspense fallback={<TaskListSkeleton />}>
                                                    <ProjectDetail />
                                                </Suspense>
                                            }
                                        />
                                        <Route
                                            path="settings"
                                            element={
                                                <Suspense fallback={<div className="h-screen bg-background" />}>
                                                    <Settings />
                                                </Suspense>
                                            }
                                        />
                                        <Route path="*" element={<Navigate to="/today" replace />} />
                                    </Route>
                                </Routes>
                            </Suspense>
                        </ToastProvider>
                    </TaskProvider>
                </ShortcutProvider>
            </BrowserRouter>
        </ThemeProvider>
    )
}

export default App

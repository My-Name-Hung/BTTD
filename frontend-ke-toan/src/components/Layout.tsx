import { ReactNode, useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronRight,
  FiLogOut,
  FiMenu,
  FiShoppingBag,
  FiTruck,
  FiUpload,
  FiUsers,
  FiX,
  FiPlusCircle,
} from "react-icons/fi";
import {
  MdAssignment,
  MdDashboard,
  MdLocalShipping,
  MdPayments,
  MdPeople,
  MdSettings,
  MdFactory,
  MdCheckCircle,
  MdDeliveryDining,
} from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS, useAuth, useNotifications } from "../hooks";
import "./Layout.css";

const LOGO_URL =
  "https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png";

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  path: string;
  label: string;
  icon: ReactNode;
  iconActive: ReactNode;
  roles: string[];
}

// Menu cho sidebar desktop
const SIDEBAR_ITEMS: MenuItem[] = [
  // Dashboard
  {
    path: "/dashboard",
    label: "Tổng quan",
    icon: <MdDashboard size={20} />,
    iconActive: <MdDashboard size={20} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "lanh_dao", "kho"],
  },
  // Đơn hàng
  {
    path: "/quan-ly/don-hang",
    label: "Đơn hàng",
    icon: <FiShoppingBag size={20} />,
    iconActive: <FiShoppingBag size={20} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "sale"],
  },
  // Tạo đơn (sale)
  {
    path: "/quan-ly/don-hang/tao",
    label: "Tạo đơn hàng",
    icon: <FiPlusCircle size={20} />,
    iconActive: <FiPlusCircle size={20} />,
    roles: ["admin", "sale"],
  },
  // Khách hàng
  {
    path: "/khach-hang",
    label: "Khách hàng",
    icon: <MdPeople size={20} />,
    iconActive: <MdPeople size={20} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "sale"],
  },
  // Điều phối
  {
    path: "/dieu-phoi",
    label: "Điều phối",
    icon: <MdLocalShipping size={20} />,
    iconActive: <MdLocalShipping size={20} />,
    roles: ["admin", "dieu_phoi"],
  },
  // Nghiệm thu
  {
    path: "/nghiem-thu",
    label: "Nghiệm thu",
    icon: <MdAssignment size={20} />,
    iconActive: <MdAssignment size={20} />,
    roles: ["admin", "ke_toan", "ky_thuat"],
  },
  // Thanh toán
  {
    path: "/thanh-toan",
    label: "Thanh toán",
    icon: <MdPayments size={20} />,
    iconActive: <MdPayments size={20} />,
    roles: ["admin", "ke_toan"],
  },
  // Công nợ
  {
    path: "/cong-no",
    label: "Công nợ",
    icon: <MdPayments size={20} />,
    iconActive: <MdPayments size={20} />,
    roles: ["admin", "ke_toan", "lanh_dao"],
  },
  // Kho
  {
    path: "/kho/lich-san-xuat",
    label: "Lịch sản xuất",
    icon: <MdFactory size={20} />,
    iconActive: <MdFactory size={20} />,
    roles: ["admin", "kho"],
  },
  // Tài xế
  {
    path: "/tai-xe",
    label: "Giao hàng",
    icon: <MdDeliveryDining size={20} />,
    iconActive: <MdDeliveryDining size={20} />,
    roles: ["admin", "tai_xe"],
  },
  // Kỹ thuật
  {
    path: "/ky-thuat",
    label: "Công trình",
    icon: <MdCheckCircle size={20} />,
    iconActive: <MdCheckCircle size={20} />,
    roles: ["admin", "ky_thuat"],
  },
  // Người dùng
  {
    path: "/quan-ly/nguoi-dung",
    label: "Người dùng",
    icon: <FiUsers size={20} />,
    iconActive: <FiUsers size={20} />,
    roles: ["admin"],
  },
  // Phương tiện
  {
    path: "/quan-ly/xe",
    label: "Phương tiện",
    icon: <FiTruck size={20} />,
    iconActive: <FiTruck size={20} />,
    roles: ["admin"],
  },
  // Trạm trộn
  {
    path: "/quan-ly/tram-tron",
    label: "Trạm trộn",
    icon: <MdSettings size={20} />,
    iconActive: <MdSettings size={20} />,
    roles: ["admin"],
  },
  // Tải danh sách
  {
    path: "/tai-len-danh-sach",
    label: "Tải lên DS",
    icon: <FiUpload size={20} />,
    iconActive: <FiUpload size={20} />,
    roles: ["admin", "dieu_phoi"],
  },
  // Bảo trì
  {
    path: "/bao-tri",
    label: "Bảo trì",
    icon: <FiSettings size={20} />,
    iconActive: <FiSettings size={20} />,
    roles: ["admin"],
  },
];

// Bottom tab items - dùng chung trên mobile
const BOTTOM_TABS = [
  {
    path: "/dashboard",
    label: "Tổng quan",
    icon: <MdDashboard size={22} />,
    iconActive: <MdDashboard size={22} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "lanh_dao", "kho", "sale", "tai_xe", "ky_thuat"],
  },
  {
    path: "/quan-ly/don-hang",
    label: "Đơn hàng",
    icon: <FiShoppingBag size={22} />,
    iconActive: <FiShoppingBag size={22} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "sale", "tai_xe", "ky_thuat"],
  },
  {
    path: "/thong-bao",
    label: "Thông báo",
    icon: <FiBell size={22} />,
    iconActive: <FiBell size={22} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "lanh_dao", "kho", "sale", "tai_xe", "ky_thuat"],
  },
];

export function Layout({ children }: LayoutProps) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notifications
  const vaiTro = user?.vaiTro || "";
  const { unreadCount, refreshUnreadCount, PopupContainer } =
    useNotifications(vaiTro, user?.id);

  useEffect(() => {
    if (user?.id) refreshUnreadCount();
  }, [user?.id, refreshUnreadCount]);

  useEffect(() => {
    const handler = () => refreshUnreadCount();
    window.addEventListener("bttd:notifications-refresh", handler);
    return () => window.removeEventListener("bttd:notifications-refresh", handler);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) navigate("/login");
  }, [navigate]);

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return null;

  const currentItem = SIDEBAR_ITEMS.find(
    (m) => location.pathname === m.path || location.pathname.startsWith(m.path + "/")
  );
  const pageTitle = currentItem?.label || "Bê Tông Tây Đô";

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  const visibleSidebarItems = SIDEBAR_ITEMS.filter((item) =>
    item.roles.includes(vaiTro)
  );
  const visibleBottomTabs = BOTTOM_TABS.filter((tab) =>
    tab.roles.includes(vaiTro)
  );

  return (
    <>
      <PopupContainer />
      <div className="app-layout">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar desktop */}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-logo">
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              <FiX size={20} />
            </button>
            <img src={LOGO_URL} alt="Bê Tông Tây Đô" className="sidebar-logo-img" />
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">Bê Tông Tây Đô</span>
              <span className="sidebar-logo-sub">Hệ thống quản lý</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {visibleSidebarItems.map((item) => (
              <div
                key={item.path}
                className={`nav-item ${
                  location.pathname === item.path ? "nav-item-active" : ""
                }`}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">
                  {location.pathname === item.path ? item.iconActive : item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                {user?.hoTen?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="user-info-text">
                <div className="user-name">{user?.hoTen}</div>
                <div className="user-role">
                  {ROLE_LABELS[user?.vaiTro as keyof typeof ROLE_LABELS] ||
                    user?.vaiTro}
                </div>
              </div>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={logout}
            >
              <FiLogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          {/* Header */}
          <header className="header">
            <div className="header-left">
              <button
                className="header-hamburger"
                onClick={() => setSidebarOpen(true)}
              >
                <FiMenu size={20} />
              </button>
              <div className="header-title-group">
                <h1 className="header-title">{pageTitle}</h1>
                <div className="header-breadcrumb">
                  <span>Trang chủ</span>
                  <FiChevronRight size={12} />
                  <span>{pageTitle}</span>
                </div>
              </div>
            </div>
            <div className="header-right">
              <span className="header-date">{today}</span>
              <button
                className="header-bell-btn"
                onClick={() => navigate("/thong-bao")}
                title="Thông báo"
              >
                <FiBell size={20} />
                {unreadCount > 0 && (
                  <span className="header-bell-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="page-content">{children}</div>
        </main>

        {/* Bottom tab bar - mobile only */}
        <nav className="bottom-tab-bar">
          {visibleBottomTabs.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              location.pathname.startsWith(tab.path + "/");
            return (
              <button
                key={tab.path}
                className={`bottom-tab-item ${isActive ? "bottom-tab-active" : ""}`}
                onClick={() => {
                  navigate(tab.path);
                  setSidebarOpen(false);
                }}
              >
                <span className="bottom-tab-icon">
                  {isActive ? tab.iconActive : tab.icon}
                  {tab.path === "/thong-bao" && unreadCount > 0 && (
                    <span className="bottom-tab-badge">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className="bottom-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

import { ReactNode, useEffect, useState } from "react";
import {
  FiActivity,
  FiBell,
  FiChevronRight,
  FiLogOut,
  FiMenu,
  FiPlusCircle,
  FiSettings,
  FiShoppingBag,
  FiTruck,
  FiUpload,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  MdAssignment,
  MdDashboard,
  MdDeliveryDining,
  MdFactory,
  MdLocalShipping,
  MdPayments,
  MdPeople,
  MdSettings,
} from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS, useAuth, useNotifications } from "../../shared/hooks";
import "../../shared/styles/layout.css";

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

const SIDEBAR_ITEMS: MenuItem[] = [
  // Dashboard
  {
    path: "/dashboard",
    label: "Tổng quan",
    icon: <MdDashboard size={20} />,
    iconActive: <MdDashboard size={20} />,
    roles: [
      "admin",
      "ke_toan",
      "dieu_phoi",
      "lanh_dao",
      "tram_tron",
      "sale",
      "tai_xe",
      "ky_thuat",
    ],
  },
  // Bán hàng
  {
    path: "/quan-ly/don-hang",
    label: "Đơn hàng",
    icon: <FiShoppingBag size={20} />,
    iconActive: <FiShoppingBag size={20} />,
    roles: [
      "admin",
      "ke_toan",
      "dieu_phoi",
      "sale",
      "tram_tron",
      "tai_xe",
      "ky_thuat",
      "lanh_dao",
    ],
  },
  {
    path: "/quan-ly/don-hang/tao",
    label: "Tạo đơn hàng",
    icon: <FiPlusCircle size={20} />,
    iconActive: <FiPlusCircle size={20} />,
    roles: ["admin", "sale", "dieu_phoi"],
  },
  {
    path: "/khach-hang",
    label: "Khách hàng",
    icon: <MdPeople size={20} />,
    iconActive: <MdPeople size={20} />,
    roles: ["admin", "ke_toan", "dieu_phoi", "sale"],
  },
  // Sản xuất - Trạm trộn
  {
    path: "/tram-tron/lich-san-xuat",
    label: "Lịch sản xuất",
    icon: <MdFactory size={20} />,
    iconActive: <MdFactory size={20} />,
    roles: ["admin", "tram_tron"],
  },
  // Điều phối
  {
    path: "/dieu-phoi",
    label: "Điều phối",
    icon: <MdLocalShipping size={20} />,
    iconActive: <MdLocalShipping size={20} />,
    roles: ["admin", "dieu_phoi"],
  },
  {
    path: "/dieu-phoi/mac-be-tong",
    label: "Mác bê tông",
    icon: <MdFactory size={20} />,
    iconActive: <MdFactory size={20} />,
    roles: ["admin", "dieu_phoi", "sale"],
  },
  // Giao hàng
  {
    path: "/tai-xe",
    label: "Giao hàng",
    icon: <MdDeliveryDining size={20} />,
    iconActive: <MdDeliveryDining size={20} />,
    roles: ["admin", "tai_xe"],
  },
  {
    path: "/tai-xe/lich-su-giao",
    label: "Lịch sử giao",
    icon: <MdDeliveryDining size={20} />,
    iconActive: <MdDeliveryDining size={20} />,
    roles: ["admin", "tai_xe"],
  },
  // Nghiệm thu
  {
    path: "/nghiem-thu",
    label: "Nghiệm thu",
    icon: <MdAssignment size={20} />,
    iconActive: <MdAssignment size={20} />,
    roles: ["admin", "ky_thuat", "ke_toan"],
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
  // Quản trị (admin only)
  {
    path: "/quan-ly/nguoi-dung",
    label: "Người dùng",
    icon: <FiUsers size={20} />,
    iconActive: <FiUsers size={20} />,
    roles: ["admin"],
  },
  {
    path: "/quan-ly/xe",
    label: "Phương tiện",
    icon: <FiTruck size={20} />,
    iconActive: <FiTruck size={20} />,
    roles: ["admin"],
  },
  {
    path: "/quan-ly/tram-tron",
    label: "Trạm trộn",
    icon: <MdSettings size={20} />,
    iconActive: <MdSettings size={20} />,
    roles: ["admin"],
  },
  {
    path: "/tai-len-danh-sach",
    label: "Tải lên DS",
    icon: <FiUpload size={20} />,
    iconActive: <FiUpload size={20} />,
    roles: ["admin"],
  },
  {
    path: "/bao-tri",
    label: "Bảo trì",
    icon: <FiSettings size={20} />,
    iconActive: <FiSettings size={20} />,
    roles: ["admin"],
  },
  {
    path: "/lich-su-truy-cap",
    label: "Lịch sử truy cập",
    icon: <FiActivity size={20} />,
    iconActive: <FiActivity size={20} />,
    roles: ["admin"],
  },
];

// Nhóm menu cho sidebar desktop
export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const SIDEBAR_GROUPS: MenuGroup[] = [
  {
    title: "Tổng quan",
    items: SIDEBAR_ITEMS.filter((m) => m.path === "/dashboard"),
  },
  // === BÁN HÀNG ===
  {
    title: "Bán hàng",
    items: SIDEBAR_ITEMS.filter((m) =>
      ["/quan-ly/don-hang", "/quan-ly/don-hang/tao", "/khach-hang"].includes(
        m.path,
      ),
    ),
  },
  // === SẢN XUẤT / TRẠM TRỘN ===
  {
    title: "Trạm trộn",
    items: SIDEBAR_ITEMS.filter((m) =>
      ["/tram-tron/lich-san-xuat"].includes(m.path),
    ),
  },
  // === ĐIỀU PHỐI ===
  {
    title: "Điều phối",
    items: SIDEBAR_ITEMS.filter((m) =>
      ["/dieu-phoi", "/dieu-phoi/mac-be-tong"].includes(m.path),
    ),
  },
  // === GIAO HÀNG ===
  {
    title: "Giao hàng",
    items: SIDEBAR_ITEMS.filter((m) =>
      ["/tai-xe", "/tai-xe/lich-su-giao"].includes(m.path),
    ),
  },
  // === NGHIỆM THU ===
  {
    title: "Nghiệm thu",
    items: SIDEBAR_ITEMS.filter((m) => ["/nghiem-thu"].includes(m.path)),
  },
  // === THANH TOÁN & CÔNG NỢ ===
  {
    title: "Thanh toán",
    items: SIDEBAR_ITEMS.filter((m) =>
      ["/thanh-toan", "/cong-no"].includes(m.path),
    ),
  },
  // === QUẢN TRỊ (admin only) ===
  {
    title: "Quản trị",
    items: SIDEBAR_ITEMS.filter((m) =>
      [
        "/quan-ly/nguoi-dung",
        "/quan-ly/xe",
        "/quan-ly/tram-tron",
        "/tai-len-danh-sach",
        "/bao-tri",
        "/lich-su-truy-cap",
      ].includes(m.path),
    ),
  },
];

// Bottom tab items - dùng chung trên mobile
const BOTTOM_TABS = [
  {
    path: "/dashboard",
    label: "Tổng quan",
    icon: <MdDashboard size={22} />,
    iconActive: <MdDashboard size={22} />,
    roles: [
      "admin",
      "ke_toan",
      "dieu_phoi",
      "lanh_dao",
      "tram_tron",
      "sale",
      "tai_xe",
      "ky_thuat",
    ],
  },
  {
    path: "/quan-ly/don-hang",
    label: "Đơn hàng",
    icon: <FiShoppingBag size={22} />,
    iconActive: <FiShoppingBag size={22} />,
    roles: [
      "admin",
      "ke_toan",
      "dieu_phoi",
      "sale",
      "tram_tron",
      "tai_xe",
      "ky_thuat",
      "lanh_dao",
    ],
  },
  {
    path: "/tram-tron/lich-san-xuat",
    label: "Trạm trộn",
    icon: <MdFactory size={22} />,
    iconActive: <MdFactory size={22} />,
    roles: ["admin", "tram_tron", "dieu_phoi", "sale"],
  },
  {
    path: "/dieu-phoi",
    label: "Điều phối",
    icon: <MdLocalShipping size={22} />,
    iconActive: <MdLocalShipping size={22} />,
    roles: ["admin", "dieu_phoi"],
  },
  {
    path: "/tai-xe",
    label: "Giao hàng",
    icon: <MdDeliveryDining size={22} />,
    iconActive: <MdDeliveryDining size={22} />,
    roles: ["admin", "tai_xe"],
  },
  {
    path: "/nghiem-thu",
    label: "Nghiệm thu",
    icon: <MdAssignment size={22} />,
    iconActive: <MdAssignment size={22} />,
    roles: ["admin", "ky_thuat"],
  },
  {
    path: "/thong-bao",
    label: "Thông báo",
    icon: <FiBell size={22} />,
    iconActive: <FiBell size={22} />,
    roles: [
      "admin",
      "ke_toan",
      "dieu_phoi",
      "lanh_dao",
      "tram_tron",
      "sale",
      "tai_xe",
      "ky_thuat",
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Notifications
  const vaiTro = user?.vaiTro || "";
  const { unreadCount, refreshUnreadCount, PopupContainer } = useNotifications(
    vaiTro,
    user?.id,
  );

  useEffect(() => {
    if (user?.id) refreshUnreadCount();
  }, [user?.id, refreshUnreadCount]);

  useEffect(() => {
    const handler = () => refreshUnreadCount();
    window.addEventListener("bttd:notifications-refresh", handler);
    return () =>
      window.removeEventListener("bttd:notifications-refresh", handler);
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
    (m) =>
      location.pathname === m.path ||
      location.pathname.startsWith(m.path + "/"),
  );
  const pageTitle = currentItem?.label || "Bê Tông Tây Đô";

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  const visibleSidebarItems = SIDEBAR_ITEMS.filter((item) =>
    item.roles.includes(vaiTro),
  );
  const visibleBottomTabs = BOTTOM_TABS.filter((tab) =>
    tab.roles.includes(vaiTro),
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
        <aside
          className={`sidebar ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
        >
          <div className="sidebar-logo">
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              <FiX size={20} />
            </button>
            {!sidebarCollapsed && (
              <>
                <a href="/">
                  <img
                    src={LOGO_URL}
                    alt="Bê Tông Tây Đô"
                    className="sidebar-logo-img"
                  />
                </a>
                <div className="sidebar-logo-text">
                  <span className="sidebar-logo-name">Bê Tông Tây Đô</span>
                  <span className="sidebar-logo-sub">Hệ thống quản lý</span>
                </div>
              </>
            )}
            {sidebarCollapsed && (
              <img
                src={LOGO_URL}
                alt="Bê Tông Tây Đô"
                className="sidebar-logo-img sidebar-logo-img-center"
              />
            )}
          </div>

          <nav className="sidebar-nav">
            {SIDEBAR_GROUPS.map((group) => {
              const groupItems = visibleSidebarItems.filter((item) =>
                group.items.some((gi) => gi.path === item.path),
              );
              if (groupItems.length === 0) return null;
              return (
                <div key={group.title} className="nav-group">
                  {!sidebarCollapsed && (
                    <div className="nav-group-title">{group.title}</div>
                  )}
                  {groupItems.map((item) => (
                    <div
                      key={item.path}
                      className={`nav-item ${location.pathname === item.path ? "nav-item-active" : ""} ${sidebarCollapsed ? "nav-item-collapsed" : ""}`}
                      onClick={() => {
                        navigate(item.path);
                        setSidebarOpen(false);
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="nav-icon">
                        {location.pathname === item.path
                          ? item.iconActive
                          : item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="nav-label">{item.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            {!sidebarCollapsed && (
              <>
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
                <button className="sidebar-logout-btn" onClick={logout}>
                  <FiLogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <button
                className="sidebar-logout-btn sidebar-logout-btn-collapsed"
                onClick={logout}
                title="Đăng xuất"
              >
                <FiLogOut size={16} />
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main
          className={`main-content ${sidebarCollapsed ? "main-content-collapsed" : ""}`}
        >
          {/* Header */}
          <header className="header">
            <div className="header-left">
              <button
                className="header-hamburger"
                onClick={() => setSidebarOpen(true)}
              >
                <FiMenu size={20} />
              </button>
              <button
                className="header-collapse-btn"
                onClick={() => setSidebarCollapsed((v) => !v)}
                title={sidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
              >
                {sidebarCollapsed ? (
                  <FiChevronRight size={18} />
                ) : (
                  <FiMenu size={18} />
                )}
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
